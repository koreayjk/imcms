-- 뉴스레터 자동 발송 예약 (Supabase SQL 에디터에서 실행. mail.sql·groups.sql·press-cron.sql 다음. 여러 번 실행해도 된다)
--   편집장·발행인이 "한 번만(날짜) / 매주 / 2주마다 / 매월"과 시각(한국 시간, 정시), 넣을 최근 기사 수를 정해 두면
--   IM 뉴스룸 서버가 10분마다 확인해 때가 된 예약을 보낸다. 지난 뉴스레터 뒤에 발행된 기사만 넣고, 새 기사가 없으면 건너뛴다
--   보내기 하루 전에 편집장에게 미리보기 안내 메일을 보낸다 (이번 회차만 건너뛸 수 있다)

create table if not exists newsletter_schedules (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  kind text not null check (kind in ('once', 'weekly', 'biweekly', 'monthly')),
  send_on date,                                                   -- 한 번만: 보내는 날
  weekday smallint check (weekday between 0 and 6),               -- 매주·2주마다: 요일 (0 = 일요일)
  month_day smallint check (month_day between 1 and 28),          -- 매월: 날짜
  hour smallint not null default 7 check (hour between 0 and 23), -- 한국 시간, 정시
  article_count smallint not null default 5 check (article_count between 1 and 15),
  section_slug text,                                              -- 이 섹션 기사만 (없으면 전체)
  subject_template text not null default '{매체} {날짜} 주요 뉴스' check (char_length(subject_template) between 1 and 150),
  intro text check (intro is null or char_length(intro) <= 3000),
  enabled boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  last_result text,
  preview_for timestamptz,                                        -- 미리보기 안내를 보낸 회차
  locked_until timestamptz,
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletter_schedules_due on newsletter_schedules(next_run_at) where enabled;
alter table newsletter_schedules enable row level security;
drop policy if exists "nl_schedules_manage" on newsletter_schedules;
create policy "nl_schedules_manage" on newsletter_schedules for all to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

alter table newsletter_campaigns add column if not exists schedule_id uuid references newsletter_schedules(id) on delete set null;

-- 서버: 때가 된 예약 (한 번에 몇 건씩, 다른 실행과 겹치지 않게 5분 잠금). 미납 제한·해지 매체는 뺀다
create or replace function public.nl_schedule_take(secret text, p_limit integer default 2) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  with picked as (
    select s.id from newsletter_schedules s join outlets o on o.id = s.outlet_id
    where s.enabled and s.next_run_at is not null and s.next_run_at <= now()
      and (s.locked_until is null or s.locked_until < now())
      and not coalesce((to_jsonb(o) ->> 'billing_hold')::boolean, false)
      and (to_jsonb(o) ->> 'terminated_at') is null
    order by s.next_run_at
    limit greatest(1, least(coalesce(p_limit, 2), 5))
    for update of s skip locked
  ), upd as (
    update newsletter_schedules s set locked_until = now() + interval '5 minutes' from picked where s.id = picked.id returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'schedule', to_jsonb(u),
    'outlet', (select to_jsonb(o) from outlets o where o.id = u.outlet_id),
    'categories', coalesce((select jsonb_agg(to_jsonb(c)) from categories c where c.outlet_id = u.outlet_id), '[]'::jsonb),
    'usedThisMonth', (select count(*) from newsletter_campaigns nc where nc.outlet_id = u.outlet_id and nc.status = 'sent'
                      and nc.sent_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')),
    'subscribers', (select count(*) from newsletter_subscribers ns where ns.outlet_id = u.outlet_id and ns.status = 'subscribed')
  )), '[]'::jsonb) into res from upd u;
  return res;
end $$;
revoke all on function public.nl_schedule_take(text, integer) from public;
grant execute on function public.nl_schedule_take(text, integer) to anon, authenticated;

-- 서버: 넣을 기사 (지난 뉴스레터 뒤에 발행된 것, 없으면 최근 30일). 섹션을 정했으면 그 섹션(하위 섹션 포함)만
create or replace function public.nl_auto_articles(secret text, o uuid, n integer, p_section text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz; res jsonb;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  since := coalesce((select max(sent_at) from newsletter_campaigns where outlet_id = o and status = 'sent'), now() - interval '30 days');
  select coalesce(jsonb_agg(x order by x.published_at desc), '[]'::jsonb) into res from (
    select a.id, a.title, a.excerpt, a.thumbnail_url, a.published_at, c.name as category
    from articles a left join categories c on c.id = a.category_id
    where a.outlet_id = o and a.status::text = 'published' and a.published_at > since and a.published_at <= now()
      and (p_section is null or c.slug = p_section or (to_jsonb(c) ->> 'parent_slug') = p_section)
    order by a.published_at desc
    limit greatest(1, least(coalesce(n, 5), 15))
  ) x;
  return res;
end $$;
revoke all on function public.nl_auto_articles(text, uuid, integer, text) from public;
grant execute on function public.nl_auto_articles(text, uuid, integer, text) to anon, authenticated;

-- 서버: 받는 사람 (구독 중인 독자, 보내는 순간의 명단)
create or replace function public.nl_auto_subscribers(secret text, o uuid, lim integer) returns table (email text, token text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query select s.email::text, s.token::text from newsletter_subscribers s where s.outlet_id = o and s.status = 'subscribed' limit lim;
end $$;
revoke all on function public.nl_auto_subscribers(text, uuid, integer) from public;
grant execute on function public.nl_auto_subscribers(text, uuid, integer) to anon, authenticated;

-- 서버: 결과 기록 (보냈으면 보낸 기록도 남긴다) + 다음 회차. p_next 가 없으면 예약을 끈다 (한 번만 보내기)
create or replace function public.nl_schedule_done(secret text, p_id uuid, p_result text, p_next timestamptz,
  p_subject text default null, p_intro text default null, p_article_ids uuid[] default null, p_sent integer default 0, p_failed integer default 0) returns void
language plpgsql security definer set search_path = public as $$
declare s newsletter_schedules%rowtype;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into s from newsletter_schedules where id = p_id;
  if s.id is null then return; end if;
  if p_subject is not null then
    insert into newsletter_campaigns (outlet_id, subject, intro, article_ids, status, recipient_count, failed_count, sent_by, schedule_id)
    values (s.outlet_id, left(p_subject, 150), nullif(left(p_intro, 3000), ''), coalesce(p_article_ids, '{}'),
      case when p_sent > 0 then 'sent' else 'failed' end, coalesce(p_sent, 0), coalesce(p_failed, 0), null, s.id);
  end if;
  update newsletter_schedules set last_run_at = now(), last_result = left(p_result, 300), next_run_at = p_next,
    enabled = enabled and p_next is not null, locked_until = null, updated_at = now()
  where id = p_id;
end $$;
revoke all on function public.nl_schedule_done(text, uuid, text, timestamptz, text, text, uuid[], integer, integer) from public;
grant execute on function public.nl_schedule_done(text, uuid, text, timestamptz, text, text, uuid[], integer, integer) to anon, authenticated;

-- 서버: 하루 전 미리보기 안내 대상 (20~26시간 뒤에 보낼 예약, 아직 안내 안 한 회차) + 받는 사람(그 매체 편집장·발행인)
create or replace function public.nl_preview_take(secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  with picked as (
    update newsletter_schedules s set preview_for = s.next_run_at
    where s.enabled and s.next_run_at between now() + interval '20 hours' and now() + interval '26 hours'
      and s.preview_for is distinct from s.next_run_at
    returning s.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'schedule', to_jsonb(p),
    'outletName', (select name from outlets o where o.id = p.outlet_id),
    'to', coalesce((select jsonb_agg(distinct u.email) from profiles pr join auth.users u on u.id = pr.id
                    where u.email is not null and coalesce(pr.email_notify, true)
                      and ((pr.outlet_id = p.outlet_id and pr.role in ('editor', 'admin')) or pr.id = p.created_by)), '[]'::jsonb)
  )), '[]'::jsonb) into res from picked p;
  return res;
end $$;
revoke all on function public.nl_preview_take(text) from public;
grant execute on function public.nl_preview_take(text) to anon, authenticated;

-- 10분마다 IM 뉴스룸 서버를 부른다 (press-cron.sql 의 예약 작업 열쇠로)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from private.settings where key = 'press_cron_secret') then
    perform cron.schedule('newsletter-auto', '*/10 * * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/newsletter',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 60000
      );
    $job$);
  else
    raise notice '예약 작업(pg_cron) 또는 press-cron.sql 열쇠가 없어 자동 실행은 켜지 않았습니다.';
  end if;
end $$;

select '뉴스레터 자동 발송 설치 완료' as "결과";
