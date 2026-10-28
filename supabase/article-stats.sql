-- 기사 통계 (편집장 이상이 편집국 "통계"에서 조회수·공유·댓글을 본다). Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다
--   · 기사별 하루 조회수·공유 수를 따로 쌓는다 (오늘·이번 주·이번 달·올해 순위용). 이 SQL을 실행한 날부터 쌓이고,
--     그 전 조회수는 기사마다 "전체 조회수"(view_count)에만 있다
--   · 공유 수 = 독자가 기사 페이지에서 공유 버튼(페이스북·X·카카오톡·링크 복사)을 누른 횟수 (같은 브라우저는 10분에 한 번만 센다)
--   · 하루의 기준은 그 매체의 시간대(홈페이지 설정의 시간대, 없으면 한국 시간)

alter table articles add column if not exists share_count integer not null default 0;

create table if not exists article_stats_daily (
  article_id uuid not null references articles(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  shares integer not null default 0,
  primary key (article_id, day)
);
create index if not exists article_stats_outlet_day on article_stats_daily (outlet_id, day);
alter table article_stats_daily enable row level security;
drop policy if exists "article_stats_read" on article_stats_daily;
create policy "article_stats_read" on article_stats_daily for select to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));
do $$ begin
  if to_regprocedure('public.session_ok()') is not null then
    drop policy if exists "zz_account_ok" on public.article_stats_daily;
    create policy "zz_account_ok" on public.article_stats_daily as restrictive for all to authenticated using (public.session_ok()) with check (public.session_ok());
  end if;
end $$;

-- 매체의 "오늘" (시간대가 잘못 적혀 있어도 한국 시간으로 대신한다)
create or replace function public.outlet_today(o uuid) returns date
language plpgsql stable security definer set search_path = public as $$
declare tz text; d date;
begin
  select coalesce(nullif(site->>'timeZone', ''), 'Asia/Seoul') into tz from outlets where id = o;
  begin
    d := (now() at time zone coalesce(tz, 'Asia/Seoul'))::date;
  exception when others then
    d := (now() at time zone 'Asia/Seoul')::date;
  end;
  return d;
end $$;
grant execute on function public.outlet_today(uuid) to authenticated, anon;

-- 조회수 +1 (전체 + 하루치). 수정 시각(updated_at)은 건드리지 않는다 (view-count.sql 과 같다)
create or replace function public.increment_article_view(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  perform set_config('app.view_only', 'on', true);
  update articles set view_count = view_count + 1
  where id = p_id and status = 'published' and (published_at is null or published_at <= now())
  returning outlet_id into o;
  perform set_config('app.view_only', 'off', true);
  if o is not null then
    insert into article_stats_daily (article_id, outlet_id, day, views) values (p_id, o, public.outlet_today(o), 1)
    on conflict (article_id, day) do update set views = article_stats_daily.views + 1;
  end if;
end $$;
revoke all on function public.increment_article_view(uuid) from public;
grant execute on function public.increment_article_view(uuid) to anon, authenticated;

-- 공유 +1
create or replace function public.bump_article_share(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  perform set_config('app.view_only', 'on', true);
  update articles set share_count = share_count + 1
  where id = p_id and status = 'published' and (published_at is null or published_at <= now())
  returning outlet_id into o;
  perform set_config('app.view_only', 'off', true);
  if o is not null then
    insert into article_stats_daily (article_id, outlet_id, day, shares) values (p_id, o, public.outlet_today(o), 1)
    on conflict (article_id, day) do update set shares = article_stats_daily.shares + 1;
  end if;
end $$;
revoke all on function public.bump_article_share(uuid) from public;
grant execute on function public.bump_article_share(uuid) to anon, authenticated;

-- 요약: 오늘·이번 주·이번 달·올해(날짜 경계는 화면이 매체 시간대로 계산해 넘긴다), 전체 조회수·공유·댓글
--   권한은 읽는 사람 기준 (매체 편집장 이상·발행인·운영팀). p_outlet 이 null 이면 볼 수 있는 모든 매체
create or replace function public.outlet_view_summary(p_outlet uuid, p_today date, p_week date, p_month date, p_year date)
returns table (v_today bigint, v_week bigint, v_month bigint, v_year bigint, v_total bigint, s_total bigint, c_approved bigint, c_pending bigint)
language sql stable security invoker set search_path = public as $$
  select
    coalesce(sum(d.views) filter (where d.day >= p_today), 0),
    coalesce(sum(d.views) filter (where d.day >= p_week), 0),
    coalesce(sum(d.views) filter (where d.day >= p_month), 0),
    coalesce(sum(d.views) filter (where d.day >= p_year), 0),
    (select coalesce(sum(a.view_count), 0) from articles a where a.status = 'published' and (p_outlet is null or a.outlet_id = p_outlet)),
    (select coalesce(sum(a.share_count), 0) from articles a where a.status = 'published' and (p_outlet is null or a.outlet_id = p_outlet)),
    (select count(*) from comments c where c.status = 'approved' and (p_outlet is null or c.outlet_id = p_outlet)),
    (select count(*) from comments c where c.status = 'pending' and (p_outlet is null or c.outlet_id = p_outlet))
  from article_stats_daily d where (p_outlet is null or d.outlet_id = p_outlet) and d.day >= p_year
$$;
grant execute on function public.outlet_view_summary(uuid, date, date, date, date) to authenticated;

-- 하루별 조회수·공유 (그래프용)
create or replace function public.outlet_daily_views(p_outlet uuid, p_from date)
returns table (day date, views bigint, shares bigint)
language sql stable security invoker set search_path = public as $$
  select d.day, sum(d.views), sum(d.shares) from article_stats_daily d
  where (p_outlet is null or d.outlet_id = p_outlet) and d.day >= p_from
  group by d.day order by d.day
$$;
grant execute on function public.outlet_daily_views(uuid, date) to authenticated;

-- 기사별 통계 표: p_from 이 null 이면 "전체"(쌓인 전체 조회수·공유), 날짜를 주면 그날부터의 조회수·공유
--   p_sort: views(조회순) / comments(댓글 많은 순) / shares(공유 많은 순)
create or replace function public.article_stats_list(p_outlet uuid, p_from date, p_sort text, p_limit integer default 30)
returns table (id uuid, title text, outlet_name text, category_name text, published_at timestamptz,
               views bigint, views_total bigint, comments bigint, comments_pending bigint, shares bigint, shares_total bigint)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, o.name, c.name, a.published_at,
         case when p_from is null then a.view_count::bigint else coalesce(d.views, 0) end,
         a.view_count::bigint,
         coalesce(cm.n, 0) + coalesce(cm.pending, 0), coalesce(cm.pending, 0),
         case when p_from is null then a.share_count::bigint else coalesce(d.shares, 0) end,
         a.share_count::bigint
  from articles a
  join outlets o on o.id = a.outlet_id
  left join categories c on c.id = a.category_id
  left join (select article_id, sum(views) as views, sum(shares) as shares from article_stats_daily
             where p_from is not null and day >= p_from and (p_outlet is null or outlet_id = p_outlet) group by article_id) d on d.article_id = a.id
  left join (select article_id, count(*) filter (where status = 'approved') as n, count(*) filter (where status = 'pending') as pending
             from comments where (p_outlet is null or outlet_id = p_outlet) group by article_id) cm on cm.article_id = a.id
  where a.status = 'published' and (p_outlet is null or a.outlet_id = p_outlet)
  order by (case p_sort
              when 'comments' then coalesce(cm.n, 0) + coalesce(cm.pending, 0)
              when 'shares' then case when p_from is null then a.share_count::bigint else coalesce(d.shares, 0) end
              else case when p_from is null then a.view_count::bigint else coalesce(d.views, 0) end
            end) desc, a.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;
grant execute on function public.article_stats_list(uuid, date, text, integer) to authenticated;
