-- 이메일로 받은 보도자료 → 보도자료함 (Supabase SQL 에디터에서 1회 실행, press-releases.sql·press-cron.sql 다음)
-- 기자마다 전용 전달 주소가 생기고, 메일 수신 서비스(Postmark 등)가 받은 메일을 IM 뉴스룸으로 넘겨준다

-- 1) 기자별 전용 주소 표 (주소 = 수신 주소의 @ 앞에 +토큰)
create table if not exists press_inboxes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now(),
  verify_code text,
  verify_link text,
  verify_at timestamptz,
  last_received_at timestamptz,
  received_count int not null default 0
);
alter table press_inboxes enable row level security;
drop policy if exists "press_inboxes_own" on press_inboxes;
create policy "press_inboxes_own" on press_inboxes for select to authenticated using (user_id = auth.uid());

-- 2) 메일 첨부파일 (사진은 기자가 처음 열 때 사진 저장소로 옮긴다)
create table if not exists press_attachments (
  id uuid primary key default gen_random_uuid(),
  press_release_id uuid not null references press_releases(id) on delete cascade,
  name text not null,
  content_type text not null,
  size int not null,
  data bytea,
  copied_url text,
  created_at timestamptz not null default now()
);
create index if not exists press_attachments_release_idx on press_attachments(press_release_id);
alter table press_attachments enable row level security;
drop policy if exists "press_attachments_read" on press_attachments;
create policy "press_attachments_read" on press_attachments for select to authenticated using (true);
drop policy if exists "press_attachments_update" on press_attachments;
create policy "press_attachments_update" on press_attachments for update to authenticated using (true);
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_approved') then
    drop policy if exists "approved_only" on press_attachments;
    create policy "approved_only" on press_attachments as restrictive for all to authenticated
      using (public.is_approved()) with check (public.is_approved());
  end if;
end $$;

-- 3) 메일로 받은 자료도 받은 본인이 지울 수 있게
alter table press_releases add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;
drop policy if exists "press_releases_delete_own" on press_releases;
create policy "press_releases_delete_own" on press_releases for delete to authenticated
  using (source_key in ('manual', 'email') and created_by = auth.uid());

-- 4) 비밀 열쇠(메일 수신 서비스가 부를 때 확인)와 수신 주소 설정
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('press_mail_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create or replace function public.admin_press_mail_settings()
returns table (secret text, address text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception '관리자만 볼 수 있습니다.';
  end if;
  return query select
    (select value from private.settings where key = 'press_mail_secret'),
    (select value from private.settings where key = 'press_mail_address');
end $$;

create or replace function public.admin_set_press_mail_address(p_address text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception '관리자만 바꿀 수 있습니다.';
  end if;
  if p_address !~ '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception '수신 주소 형식이 올바르지 않습니다. 예: abc123@inbound.postmarkapp.com';
  end if;
  insert into private.settings (key, value) values ('press_mail_address', lower(p_address))
  on conflict (key) do update set value = excluded.value;
end $$;

-- 5) 기자 본인의 전용 주소 (없으면 만든다)
create or replace function public.my_press_inbox()
returns table (address text, token text, verify_code text, verify_link text, verify_at timestamptz, last_received_at timestamptz, received_count int)
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
           i.token, i.verify_code, i.verify_link, i.verify_at, i.last_received_at, i.received_count
    from press_inboxes i where i.user_id = auth.uid();
end $$;

-- 6) 메일 수신 서비스 → IM 뉴스룸: 확인 메일은 기자 설정 화면에, 보도자료는 보도자료함에
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

  insert into press_releases (source_key, source_name, guid, title, link, summary, body_html, published_at, created_by)
  values ('email', left(p_source_name, 80), p_guid, left(p_title, 300), '', left(p_summary, 400), p_body_html, coalesce(p_published_at, now()), owner)
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

revoke all on function public.admin_press_mail_settings() from public, anon;
revoke all on function public.admin_set_press_mail_address(text) from public, anon;
revoke all on function public.my_press_inbox() from public, anon;
revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.admin_press_mail_settings() to authenticated;
grant execute on function public.admin_set_press_mail_address(text) to authenticated;
grant execute on function public.my_press_inbox() to authenticated;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
