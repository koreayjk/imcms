-- 메일로 받는 보도자료: 언론사(매체) 1곳마다 하루에 받을 수 있는 양을 정한다 (Supabase SQL 에디터에서 1회 실행. press-email.sql 다음)
--   · 지메일 필터를 넓게 걸거나 받은 메일 전체를 넘기면 메일 수신 서비스(Resend) 한도와 보도자료함이 넘칩니다
--   · 기준: 한국 시간 하루(0시~24시). 그날 한도를 넘으면 그날 오는 메일은 받지 않고(나중에 다시 가져오지도 않음),
--           다음 날 0시부터는 새로 오는 메일을 다시 한도까지 받습니다
--   · 언론사 안에서 기자가 여러 명이어도 합쳐서 센다
--   · 한도는 요금제마다 기본값이 있고(베이직 10 · 스탠다드 20 · 프리미엄 40 · 엔터프라이즈/요금제 없음 100건), 언론사 한 곳만 따로 정할 수도 있습니다
--     (편집국 보도자료 → 메일로 받기 설정 맨 아래, 총관리자 화면에서 바꿉니다. 이 파일을 다시 실행해도 바꿔 둔 값은 그대로입니다)
--   · 여러 번 실행해도 되고, 이전에 있던 기자별 한도 버전도 이 파일이 대신합니다. press-email-fix-dedupe.sql 의 수정도 들어 있습니다

insert into private.settings (key, value) values
  ('press_mail_limit_basic', '10'), ('press_mail_limit_standard', '20'), ('press_mail_limit_premium', '40'), ('press_mail_limit_other', '100')
on conflict (key) do nothing;



-- 언론사별 하루 한도 (없으면 기본 한도)
create table if not exists press_mail_limits (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  daily_limit int not null check (daily_limit >= 0),
  updated_at timestamptz not null default now()
);
alter table press_mail_limits enable row level security;   -- 직접 읽고 쓰지 못하게(아래 함수로만)

-- 한도를 넘어 받지 못한 건수 (언론사·날짜별)
create table if not exists press_mail_drops (
  outlet_id uuid not null references outlets(id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (outlet_id, day)
);
alter table press_mail_drops enable row level security;

-- 언론사의 오늘 한도: 그 언론사에 따로 정한 값 → 요금제 기본값 → (그 밖) 기타 기본값
create or replace function public.press_mail_limit_of(o uuid) returns int language sql stable security definer set search_path = public, private as $$
  select coalesce(
    (select l.daily_limit from press_mail_limits l where l.outlet_id = o),
    (select value::int from private.settings where key = 'press_mail_limit_' || coalesce((select case plan when 'basic' then 'basic' when 'standard' then 'standard' when 'premium' then 'premium' else 'other' end from outlets where id = o), 'other')),
    30)
$$;
revoke all on function public.press_mail_limit_of(uuid) from public, anon, authenticated;

alter table press_inboxes add column if not exists dropped_count int not null default 0;
alter table press_inboxes add column if not exists last_dropped_at timestamptz;

create or replace function public.press_ingest_email(
  secret text, p_token text, p_kind text,
  p_verify_code text, p_verify_link text,
  p_source_name text, p_guid text, p_title text, p_summary text, p_body_html text, p_published_at timestamptz,
  p_attachments jsonb
) returns text language plpgsql security definer set search_path = public, private as $$
declare
  owner uuid;
  oid uuid;
  new_id uuid;
  a jsonb;
  scope text;
  g text;
  lim int;
  used int;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if secret is null or secret <> (select value from private.settings where key = 'press_mail_secret') then
    raise exception 'forbidden';
  end if;
  select user_id into owner from press_inboxes where token = lower(p_token);
  if owner is null then return 'unknown_inbox'; end if;

  if p_kind = 'verify' then
    update press_inboxes set verify_code = p_verify_code, verify_link = p_verify_link, verify_at = now() where token = lower(p_token);
    return 'verify_saved';
  end if;

  -- 이 기자가 속한 언론사의 오늘 한도
  select outlet_id into oid from profiles where id = owner;
  select public.press_mail_limit_of(oid) into lim;
  if oid is not null then
    select count(*) into used from press_releases r
      where r.source_key = 'email' and r.fetched_at >= day_start
        and r.created_by in (select id from profiles where outlet_id = oid);
  else
    select count(*) into used from press_releases r where r.source_key = 'email' and r.fetched_at >= day_start and r.created_by = owner;
  end if;
  if used >= lim then
    update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
    if oid is not null then
      insert into press_mail_drops (outlet_id, day, n) values (oid, (now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (outlet_id, day) do update set n = press_mail_drops.n + 1;
    end if;
    return 'rate_limited';
  end if;

  -- 같은 자료가 같은 그룹 기자 여러 명에게 오면 하나로, 다른 고객 그룹에는 각자 따로
  begin
    if to_regprocedure('public.profile_publisher(uuid)') is not null then
      execute 'select public.profile_publisher($1)::text' into scope using owner;
    end if;
  exception when others then scope := null;
  end;
  g := p_guid || ':' || coalesce(scope, owner::text);

  insert into press_releases (source_key, source_name, guid, title, link, summary, body_html, published_at, created_by)
  values ('email', left(p_source_name, 80), g, left(p_title, 300), '', left(p_summary, 400), p_body_html, coalesce(p_published_at, now()), owner)
  on conflict (guid) do nothing
  returning id into new_id;

  update press_inboxes set last_received_at = now(), received_count = received_count + 1 where token = lower(p_token);
  if new_id is null then return 'duplicate'; end if;

  for a in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into press_attachments (press_release_id, name, content_type, size, data)
    values (new_id, left(a->>'name', 200), left(a->>'content_type', 100), (a->>'size')::int, decode(a->>'content', 'base64'));
  end loop;
  return 'saved';
end $$;

-- 기자 화면: 우리 언론사의 오늘 한도·사용량·못 받은 건수
drop function if exists public.my_press_inbox();
create or replace function public.my_press_inbox()
returns table (address text, token text, verify_code text, verify_link text, verify_at timestamptz, last_received_at timestamptz, received_count int,
               daily_limit int, used_today int, dropped_today int)
language plpgsql security definer set search_path = public, private as $$
declare base text; t text; oid uuid; lim int; used int; dropped int;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select value into base from private.settings where key = 'press_mail_address';
  select i.token into t from press_inboxes i where i.user_id = auth.uid();
  if t is null then
    t := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into press_inboxes (user_id, token) values (auth.uid(), t);
  end if;
  select outlet_id into oid from profiles where id = auth.uid();
  select public.press_mail_limit_of(oid) into lim;
  if oid is not null then
    select count(*)::int into used from press_releases r
      where r.source_key = 'email' and r.fetched_at >= day_start and r.created_by in (select id from profiles where outlet_id = oid);
    select coalesce((select n from press_mail_drops d where d.outlet_id = oid and d.day = (now() at time zone 'Asia/Seoul')::date), 0) into dropped;
  else
    select count(*)::int into used from press_releases r where r.source_key = 'email' and r.fetched_at >= day_start and r.created_by = auth.uid();
    dropped := 0;
  end if;
  return query
    select case when base is null then null else split_part(base, '@', 1) || '+' || t || '@' || split_part(base, '@', 2) end,
           i.token, i.verify_code, i.verify_link, i.verify_at, i.last_received_at, i.received_count,
           lim, used, dropped
    from press_inboxes i where i.user_id = auth.uid();
end $$;

-- 총관리자: 언론사별 오늘 한도·사용량 보기 (plan_limit = 그 언론사 요금제의 기본 한도)
drop function if exists public.admin_press_mail_limits();
create or replace function public.admin_press_mail_limits()
returns table (outlet_id uuid, outlet_name text, plan text, plan_limit int, daily_limit int, is_custom boolean, used_today int, dropped_today int)
language plpgsql stable security definer set search_path = public, private as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if not public.is_super() then raise exception '총관리자만 볼 수 있습니다.'; end if;
  return query
    select o.id, o.name::text, coalesce(o.plan::text, ''),
           coalesce((select value::int from private.settings where key = 'press_mail_limit_' || case o.plan when 'basic' then 'basic' when 'standard' then 'standard' when 'premium' then 'premium' else 'other' end), 30),
           public.press_mail_limit_of(o.id), l.outlet_id is not null,
           (select count(*)::int from press_releases r where r.source_key = 'email' and r.fetched_at >= day_start
              and r.created_by in (select p.id from profiles p where p.outlet_id = o.id)),
           coalesce((select d.n from press_mail_drops d where d.outlet_id = o.id and d.day = (now() at time zone 'Asia/Seoul')::date), 0)
    from outlets o left join press_mail_limits l on l.outlet_id = o.id
    order by o.name;
end $$;

-- 총관리자: 요금제별 기본 한도 보기·바꾸기 (basic·standard·premium·other)
create or replace function public.admin_press_mail_plan_limits()
returns table (plan text, daily_limit int)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 볼 수 있습니다.'; end if;
  return query select replace(s.key, 'press_mail_limit_', ''), s.value::int from private.settings s
    where s.key in ('press_mail_limit_basic', 'press_mail_limit_standard', 'press_mail_limit_premium', 'press_mail_limit_other')
    order by case s.key when 'press_mail_limit_basic' then 1 when 'press_mail_limit_standard' then 2 when 'press_mail_limit_premium' then 3 else 4 end;
end $$;

create or replace function public.admin_set_press_mail_plan_limit(p_plan text, p_limit int)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 바꿀 수 있습니다.'; end if;
  if p_plan not in ('basic', 'standard', 'premium', 'other') then raise exception '요금제 이름이 올바르지 않습니다.'; end if;
  if p_limit is null or p_limit < 0 or p_limit > 2000 then raise exception '하루 한도는 0~2000건 사이로 정해 주세요.'; end if;
  insert into private.settings (key, value) values ('press_mail_limit_' || p_plan, p_limit::text)
  on conflict (key) do update set value = excluded.value;
end $$;

-- 총관리자: 언론사 한도 정하기 (p_limit 이 null 이면 기본 한도로 되돌림)
create or replace function public.admin_set_press_mail_limit(p_outlet uuid, p_limit int)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 바꿀 수 있습니다.'; end if;
  if p_limit is null then
    delete from press_mail_limits where outlet_id = p_outlet;
  else
    if p_limit < 0 or p_limit > 2000 then raise exception '하루 한도는 0~2000건 사이로 정해 주세요.'; end if;
    insert into press_mail_limits (outlet_id, daily_limit) values (p_outlet, p_limit)
    on conflict (outlet_id) do update set daily_limit = excluded.daily_limit, updated_at = now();
  end if;
end $$;

revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
revoke all on function public.my_press_inbox() from public, anon;
grant execute on function public.my_press_inbox() to authenticated;
revoke all on function public.admin_press_mail_limits() from public, anon;
revoke all on function public.admin_press_mail_plan_limits() from public, anon;
grant execute on function public.admin_press_mail_plan_limits() to authenticated;
revoke all on function public.admin_set_press_mail_plan_limit(text, int) from public, anon;
grant execute on function public.admin_set_press_mail_plan_limit(text, int) to authenticated;
grant execute on function public.admin_press_mail_limits() to authenticated;
revoke all on function public.admin_set_press_mail_limit(uuid, int) from public, anon;
grant execute on function public.admin_set_press_mail_limit(uuid, int) to authenticated;
