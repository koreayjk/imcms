-- 보도자료 메일 자동 수신을 "부가 서비스"로 (Supabase SQL 에디터에서 1회 실행. press-email-limits.sql 다음, 여러 번 실행해도 된다)
--   · 월 39,000원 부가 서비스. 프리미엄·엔터프라이즈·요금제 없음(내부) 매체는 기본 포함, 베이직·스탠다드는 신청한 매체만
--   · 신청하지 않은 베이직·스탠다드 매체는 메일 3통까지 체험(총관리자 설정 press_mail_trial_limit), 그 뒤 오는 메일은 받지 않고 건수만 센다
--   · 총관리자가 매체마다 켜고 끈다 (편집국 → 보도자료 → 메일로 받기 맨 아래). 켜면 다음 청구서부터 부가 서비스 항목이 들어간다
--   · 지금 메일로 보도자료를 받고 있는 매체는 이 파일을 처음 실행할 때 자동으로 켜 둔다 (이후 바꾼 값은 다시 실행해도 그대로)
--   · billing_targets 도 이 파일이 대신한다: billing-extra-plan.sql 을 다시 실행했다면 이 파일을 한 번 더 실행해 주세요

insert into private.settings (key, value) values ('press_mail_trial_limit', '3') on conflict (key) do nothing;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'outlets' and column_name = 'press_mail_addon') then
    alter table outlets add column press_mail_addon boolean not null default false;
    alter table outlets add column press_mail_trial_used int not null default 0;
    -- 지금 쓰는 매체는 계속 켜 둔다
    update outlets o set press_mail_addon = true
    where coalesce(o.plan, '') in ('basic', 'standard')
      and (exists (select 1 from press_releases r join profiles p on p.id = r.created_by where r.source_key = 'email' and p.outlet_id = o.id)
        or exists (select 1 from press_inboxes i join profiles p on p.id = i.user_id where p.outlet_id = o.id and i.received_count > 0));
  end if;
end $$;
alter table outlets add column if not exists press_mail_trial_used int not null default 0;
-- 부가 서비스를 켠 날(한국 날짜): 켠 달의 남은 일수를 일할로 다음 청구서에 붙인다. 기존에 켜 둔 매체는 비어 있어 일할이 붙지 않는다
alter table outlets add column if not exists press_mail_addon_since date;

-- 그 매체가 메일로 보도자료를 받을 수 있는가: 프리미엄·엔터프라이즈·요금제 없음은 포함, 베이직·스탠다드는 부가 서비스를 켠 매체
create or replace function public.press_mail_on(o uuid) returns boolean language sql stable security definer set search_path = public, private as $$
  select coalesce((select coalesce(plan, '') not in ('basic', 'standard') or press_mail_addon from outlets where id = o), true)
$$;
revoke all on function public.press_mail_on(uuid) from public, anon, authenticated;

-- 언론사의 오늘 한도: 따로 정한 값 → 요금제 기본값 (부가 서비스를 켠 베이직은 스탠다드 한도) → 기타 기본값
create or replace function public.press_mail_limit_of(o uuid) returns int language sql stable security definer set search_path = public, private as $$
  select coalesce(
    (select l.daily_limit from press_mail_limits l where l.outlet_id = o),
    (select value::int from private.settings where key = 'press_mail_limit_' ||
       coalesce((select case when plan = 'basic' and press_mail_addon then 'standard' when plan = 'basic' then 'basic' when plan = 'standard' then 'standard' when plan = 'premium' then 'premium' else 'other' end from outlets where id = o), 'other')),
    30)
$$;
revoke all on function public.press_mail_limit_of(uuid) from public, anon, authenticated;

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
  trial boolean := false;
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

  -- 이 기자가 속한 언론사: 부가 서비스를 켜지 않은 베이직·스탠다드는 체험 몇 통까지만 받는다
  select outlet_id into oid from profiles where id = owner;
  if oid is not null and not public.press_mail_on(oid) then
    if (select press_mail_trial_used from outlets where id = oid) >= coalesce((select value::int from private.settings where key = 'press_mail_trial_limit'), 3) then
      update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
      insert into press_mail_drops (outlet_id, day, n) values (oid, (now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (outlet_id, day) do update set n = press_mail_drops.n + 1;
      return 'addon_required';
    end if;
    trial := true;
  end if;
  -- 오늘 한도
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
  if trial then update outlets set press_mail_trial_used = press_mail_trial_used + 1 where id = oid; end if;

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
               daily_limit int, used_today int, dropped_today int,
               mail_on boolean, included boolean, trial_left int, dropped_week int)
language plpgsql security definer set search_path = public, private as $$
declare base text; t text; oid uuid; lim int; used int; dropped int; on_ boolean := true; inc boolean := true; tleft int := 0; wk int := 0;
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
  if oid is not null then
    select public.press_mail_on(oid) into on_;
    select coalesce(plan, '') not in ('basic', 'standard') into inc from outlets where id = oid;
    select greatest(0, coalesce((select value::int from private.settings where key = 'press_mail_trial_limit'), 3) - press_mail_trial_used) into tleft from outlets where id = oid;
    select coalesce(sum(n), 0)::int into wk from press_mail_drops d where d.outlet_id = oid and d.day >= (now() at time zone 'Asia/Seoul')::date - 6;
  end if;
  return query
    select case when base is null then null else split_part(base, '@', 1) || '+' || t || '@' || split_part(base, '@', 2) end,
           i.token, i.verify_code, i.verify_link, i.verify_at, i.last_received_at, i.received_count,
           lim, used, dropped, on_, inc, tleft, wk
    from press_inboxes i where i.user_id = auth.uid();
end $$;

-- 총관리자: 언론사별 오늘 한도·사용량 + 부가 서비스 켜짐 여부·체험 사용 수
drop function if exists public.admin_press_mail_limits();
create or replace function public.admin_press_mail_limits()
returns table (outlet_id uuid, outlet_name text, plan text, plan_limit int, daily_limit int, is_custom boolean, used_today int, dropped_today int,
               addon boolean, included boolean, trial_used int, dropped_week int)
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
           coalesce((select d.n from press_mail_drops d where d.outlet_id = o.id and d.day = (now() at time zone 'Asia/Seoul')::date), 0),
           o.press_mail_addon, coalesce(o.plan, '') not in ('basic', 'standard'), o.press_mail_trial_used,
           coalesce((select sum(d.n) from press_mail_drops d where d.outlet_id = o.id and d.day >= (now() at time zone 'Asia/Seoul')::date - 6), 0)::int
    from outlets o left join press_mail_limits l on l.outlet_id = o.id
    order by o.name;
end $$;

-- 총관리자: 부가 서비스 켜고 끄기 (끄면 체험 사용 수는 그대로라 다시 체험되지 않는다)
create or replace function public.admin_set_press_mail_addon(p_outlet uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 바꿀 수 있습니다.'; end if;
  -- 꺼져 있던 것을 켤 때만 켠 날을 기록하고(이미 켜진 것을 다시 눌러도 그대로), 끄면 지운다
  update outlets set
    -- 켠 날. 그달 마지막 날이면 다음 청구서가 이미 만들어진 뒤라서 다음 달 1일부터 청구한다 (다음 달 청구서에 못 넣어 한 달 무료가 되는 것을 막는다)
    press_mail_addon_since = case when coalesce(p_on, false) and not press_mail_addon
                                       then (case when date_trunc('month', (now() at time zone 'Asia/Seoul')::date + 1) <> date_trunc('month', (now() at time zone 'Asia/Seoul')::date)
                                                  then (now() at time zone 'Asia/Seoul')::date + 1 else (now() at time zone 'Asia/Seoul')::date end)
                                  when coalesce(p_on, false) then press_mail_addon_since else null end,
    press_mail_addon = coalesce(p_on, false)
  where id = p_outlet;
end $$;

-- 청구할 매체 목록 (billing-extra-plan.sql 과 같고, 부가 서비스 켜짐 'press_addon' 이 매체·추가 매체마다 더해졌다)
create or replace function public.billing_targets(secret text, p_month date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  prev_from timestamptz := ((m - interval '1 month')::timestamp at time zone 'Asia/Seoul');
  prev_to timestamptz := (m::timestamp at time zone 'Asia/Seoul');
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'outlet_id', o.id, 'name', o.name, 'plan', o.plan, 'press_addon', o.press_mail_addon, 'press_addon_since', o.press_mail_addon_since,
      'cycle', p.cycle, 'beta', p.beta, 'start_month', p.start_month,
      'setup_fee_pending', p.setup_fee_pending, 'custom_monthly', p.custom_monthly,
      'has_invoice', exists (select 1 from invoices i where i.outlet_id = o.id and i.month = m),
      'over_count', (select count(*) from ai_usage u where u.outlet_id = o.id and u.over_limit and u.created_at >= prev_from and u.created_at < prev_to),
      'autopay', (select jsonb_build_object('card_company', a.card_company, 'card_number', a.card_number) from outlet_autopay a where a.outlet_id = o.id and a.active),
      'children', coalesce((
        select jsonb_agg(jsonb_build_object(
          'outlet_id', c.id, 'name', c.name, 'plan', c.plan, 'press_addon', c.press_mail_addon, 'press_addon_since', c.press_mail_addon_since,
          'over_count', (select count(*) from ai_usage u where u.outlet_id = c.id and u.over_limit and u.created_at >= prev_from and u.created_at < prev_to)
        ) order by c.name)
        from outlet_plans cp join outlets c on c.id = cp.outlet_id
        where cp.bill_to = o.id and cp.auto and (cp.start_month is null or cp.start_month <= m)
      ), '[]'::jsonb)
    ) order by o.name)
    from outlet_plans p join outlets o on o.id = p.outlet_id
    where p.auto and p.bill_to is null and (p.start_month is null or p.start_month <= m)
  ), '[]'::jsonb);
end $$;

revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
revoke all on function public.my_press_inbox() from public, anon;
grant execute on function public.my_press_inbox() to authenticated;
revoke all on function public.admin_press_mail_limits() from public, anon;
grant execute on function public.admin_press_mail_limits() to authenticated;
revoke all on function public.admin_set_press_mail_addon(uuid, boolean) from public, anon;
grant execute on function public.admin_set_press_mail_addon(uuid, boolean) to authenticated;
