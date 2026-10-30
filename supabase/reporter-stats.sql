-- 기자가 "내가 쓴 기사"의 통계와 공개 댓글을 볼 수 있게 한다 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다. article-stats.sql·comments.sql 을 먼저 실행해 둘 것)
--   · 보이는 것: 내가 쓴(작성자가 나인) 발행 기사의 조회수·공유 수·공개된 댓글. 읽기만 한다
--   · 안 보이는 것: 다른 기자 기사의 숫자, 매체 전체 합계, 승인 대기·반려 댓글, 독자 이메일·접속 표시값
--   · 편집장 이상은 기존 화면(outlet_view_summary 등)을 그대로 쓴다. 아래 함수는 모두 "내 기사"만 읽는다

create or replace function public.my_stats_summary(p_today date, p_week date, p_month date, p_year date)
returns table (v_today bigint, v_week bigint, v_month bigint, v_year bigint, v_total bigint, s_total bigint, c_approved bigint, c_pending bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.session_ok(), false) then raise exception 'forbidden'; end if;
  return query
  with otz as (
    select o.id, public.outlet_tz(o.id) as tz from outlets o
    where o.id in (select outlet_id from articles where author_id = auth.uid() and status = 'published')
  ), mine as (
    select a.id, a.view_count, a.share_count,
           (a.published_at at time zone otz.tz)::date as pub,
           greatest(a.view_count - coalesce(dt.total, 0), 0) as rest
    from articles a
    join otz on otz.id = a.outlet_id
    left join (select s.article_id, sum(s.views) as total from article_stats_daily s
               where s.article_id in (select id from articles where author_id = auth.uid()) group by s.article_id) dt on dt.article_id = a.id
    where a.author_id = auth.uid() and a.status = 'published'
  ), d as (
    select s.day, s.views from article_stats_daily s where s.day >= p_year and s.article_id in (select id from mine)
  )
  select
    (coalesce((select sum(views) from d where day >= p_today), 0) + coalesce((select sum(rest) from mine where pub >= p_today), 0))::bigint,
    (coalesce((select sum(views) from d where day >= p_week), 0) + coalesce((select sum(rest) from mine where pub >= p_week), 0))::bigint,
    (coalesce((select sum(views) from d where day >= p_month), 0) + coalesce((select sum(rest) from mine where pub >= p_month), 0))::bigint,
    (coalesce((select sum(views) from d), 0) + coalesce((select sum(rest) from mine where pub >= p_year), 0))::bigint,
    coalesce((select sum(view_count) from mine), 0)::bigint,
    coalesce((select sum(share_count) from mine), 0)::bigint,
    (select count(*) from comments c where c.status = 'approved' and c.staff_reply = false and c.article_id in (select id from mine))::bigint,
    0::bigint;
end $$;
grant execute on function public.my_stats_summary(date, date, date, date) to authenticated;

create or replace function public.my_daily_views(p_from date)
returns table (day date, views bigint, shares bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.session_ok(), false) then raise exception 'forbidden'; end if;
  return query
  select s.day, sum(s.views)::bigint, sum(s.shares)::bigint from article_stats_daily s
  where s.day >= p_from and s.article_id in (select id from articles where author_id = auth.uid())
  group by s.day order by s.day;
end $$;
grant execute on function public.my_daily_views(date) to authenticated;

create or replace function public.my_article_stats(p_from date, p_sort text, p_limit integer default 30)
returns table (id uuid, title text, outlet_name text, category_name text, published_at timestamptz,
               views bigint, views_total bigint, comments bigint, comments_pending bigint, shares bigint, shares_total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.session_ok(), false) then raise exception 'forbidden'; end if;
  return query
  with otz as (
    select o.id, public.outlet_tz(o.id) as tz from outlets o
    where o.id in (select a2.outlet_id from articles a2 where a2.author_id = auth.uid() and a2.status = 'published')
  ), base as (
    select a.id, a.title, o.name as outlet_name, c.name as category_name, a.published_at,
           case when p_from is null then a.view_count::bigint
                else coalesce(d.views, 0)
                     + case when (a.published_at at time zone otz.tz)::date >= p_from then greatest(a.view_count - coalesce(dt.total, 0), 0) else 0 end
           end as views,
           a.view_count::bigint as views_total,
           coalesce(cm.n, 0) as comments, 0::bigint as comments_pending,
           case when p_from is null then a.share_count::bigint else coalesce(d.shares, 0) end as shares,
           a.share_count::bigint as shares_total
    from articles a
    join outlets o on o.id = a.outlet_id
    join otz on otz.id = a.outlet_id
    left join categories c on c.id = a.category_id
    left join (select s.article_id, sum(s.views) as views, sum(s.shares) as shares from article_stats_daily s
               where p_from is not null and s.day >= p_from group by s.article_id) d on d.article_id = a.id
    left join (select s.article_id, sum(s.views) as total from article_stats_daily s
               where p_from is not null group by s.article_id) dt on dt.article_id = a.id
    left join (select cc.article_id, count(*) as n from comments cc where cc.status = 'approved' and cc.staff_reply = false group by cc.article_id) cm on cm.article_id = a.id
    where a.author_id = auth.uid() and a.status = 'published'
  )
  select b.id, b.title, b.outlet_name, b.category_name, b.published_at, b.views, b.views_total, b.comments, b.comments_pending, b.shares, b.shares_total
  from base b
  order by (case p_sort when 'comments' then b.comments when 'shares' then b.shares else b.views end) desc, b.published_at desc nulls last
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;
grant execute on function public.my_article_stats(date, text, integer) to authenticated;

-- 내 기사에 달린 공개 댓글 (최신순). 독자 이메일·접속 표시값은 주지 않는다
create or replace function public.my_article_comments(p_limit integer default 60)
returns table (id uuid, article_id uuid, article_title text, name text, body text, created_at timestamptz, parent_id uuid, staff boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not coalesce(public.session_ok(), false) then raise exception 'forbidden'; end if;
  return query
  select c.id, c.article_id, a.title, coalesce(r.name, c.guest_name, left(split_part(r.email, '@', 1), 3) || '***'), c.body, c.created_at, c.parent_id, c.staff_reply
  from comments c
  join articles a on a.id = c.article_id
  left join readers r on r.id = c.reader_id
  where a.author_id = auth.uid() and c.status = 'approved'
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
end $$;
grant execute on function public.my_article_comments(integer) to authenticated;
