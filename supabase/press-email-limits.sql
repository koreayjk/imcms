-- 메일로 받는 보도자료: 기자 한 명이 받을 수 있는 양에 한도를 둔다 (Supabase SQL 에디터에서 1회 실행. press-email.sql 다음)
--   · 지메일 필터를 넓게 걸어 두면 하루에도 수십~수백 통이 넘어와 메일 수신 서비스(Resend) 한도와 보도자료함이 넘칩니다
--   · 기본값: 기자 한 명당 하루 30건, 한 달 300건. 넘으면 그 메일은 받지 않고, 몇 건을 못 받았는지 설정 화면에 보여 줍니다
--   · 한도는 아래 두 줄의 숫자만 바꿔 다시 실행하면 바뀝니다 (총관리자만 실행 가능)
--   · press-email-fix-dedupe.sql 의 수정(다른 그룹에 같은 자료가 와도 따로 받기)도 이 파일에 들어 있어 따로 실행하지 않아도 됩니다

insert into private.settings (key, value) values ('press_mail_daily_limit', '30') on conflict (key) do update set value = excluded.value;
insert into private.settings (key, value) values ('press_mail_monthly_limit', '300') on conflict (key) do update set value = excluded.value;

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
  new_id uuid;
  a jsonb;
  scope text;
  g text;
  d_lim int; m_lim int; n_day int; n_mon int;
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

  -- 한도: 하루(24시간)·한 달(한국 시간 기준)
  select coalesce((select value::int from private.settings where key = 'press_mail_daily_limit'), 30) into d_lim;
  select coalesce((select value::int from private.settings where key = 'press_mail_monthly_limit'), 300) into m_lim;
  select count(*) into n_day from press_releases where created_by = owner and source_key = 'email' and fetched_at > now() - interval '1 day';
  select count(*) into n_mon from press_releases where created_by = owner and source_key = 'email'
    and fetched_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
  if n_day >= d_lim or n_mon >= m_lim then
    update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
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

-- 내 전용 주소 화면에 한도·못 받은 건수도 같이 보여 준다
drop function if exists public.my_press_inbox();
create or replace function public.my_press_inbox()
returns table (address text, token text, verify_code text, verify_link text, verify_at timestamptz, last_received_at timestamptz, received_count int,
               dropped_count int, last_dropped_at timestamptz, daily_limit int, monthly_limit int, used_today int, used_month int)
language plpgsql security definer set search_path = public, private as $$
declare base text; t text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  select value into base from private.settings where key = 'press_mail_address';
  select i.token into t from press_inboxes i where i.user_id = auth.uid();
  if t is null then
    t := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into press_inboxes (user_id, token) values (auth.uid(), t);
  end if;
  return query
    select case when base is null then null else split_part(base, '@', 1) || '+' || t || '@' || split_part(base, '@', 2) end,
           i.token, i.verify_code, i.verify_link, i.verify_at, i.last_received_at, i.received_count,
           i.dropped_count, i.last_dropped_at,
           coalesce((select value::int from private.settings where key = 'press_mail_daily_limit'), 30),
           coalesce((select value::int from private.settings where key = 'press_mail_monthly_limit'), 300),
           (select count(*)::int from press_releases r where r.created_by = auth.uid() and r.source_key = 'email' and r.fetched_at > now() - interval '1 day'),
           (select count(*)::int from press_releases r where r.created_by = auth.uid() and r.source_key = 'email'
              and r.fetched_at >= (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))
    from press_inboxes i where i.user_id = auth.uid();
end $$;

revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
revoke all on function public.my_press_inbox() from public, anon;
grant execute on function public.my_press_inbox() to authenticated;
