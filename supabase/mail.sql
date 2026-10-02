-- 메일 발송: 알림 메일 + 뉴스레터 (Supabase SQL 에디터에서 실행, payments.sql·outlet-members.sql·support.sql 다음)
--   메일 주소는 로그인 정보(auth.users)에만 있어서, 받는 사람 목록은 우리 서버만 “서버 열쇠(PAYMENT_DB_SECRET)”로 꺼낸다
--   같은 알림이 짧은 시간에 여러 번 나가지 않게 발송 기록으로 막는다
--   뉴스레터 구독은 확인 메일의 링크를 눌러야 시작된다(이중 확인). 모든 뉴스레터에 수신거부 링크가 붙는다

-- ── 서버 열쇠 (payments.sql 과 같은 값. 이미 있으면 그대로) ──
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value) values ('payment_db_secret', encode(gen_random_bytes(32), 'hex')) on conflict (key) do nothing;
create or replace function public.payment_secret_ok(secret text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(secret = (select value from private.settings where key = 'payment_db_secret'), false);
$$;
revoke all on function public.payment_secret_ok(text) from public, anon, authenticated;

-- ── 알림 메일 받기 설정 (내 정보에서 끌 수 있다) ──
alter table profiles add column if not exists email_notify boolean not null default true;

-- ── 발송 기록 (운영팀만 본다) ──
create table if not exists mail_log (
  id bigint generated always as identity primary key,
  kind text not null,
  ref text,
  -- 같은 알림 중복 방지 열쇠 (예: article_submitted:기사ID:시각)
  dedupe_key text unique,
  sent integer not null default 0,
  failed integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);
alter table mail_log enable row level security;
drop policy if exists "mail_log_staff" on mail_log;
create policy "mail_log_staff" on mail_log for select to authenticated using (coalesce(public.is_staff(), false));

-- 이 알림을 지금 보내도 되는가 (같은 열쇠로 이미 보냈으면 false)
create or replace function public.mail_claim(secret text, p_kind text, p_ref text, p_key text) returns bigint
language plpgsql security definer set search_path = public as $$
declare new_id bigint;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  insert into mail_log (kind, ref, dedupe_key) values (left(p_kind, 40), left(p_ref, 80), left(p_key, 200))
  on conflict (dedupe_key) do nothing returning id into new_id;
  return new_id;
end $$;
create or replace function public.mail_done(secret text, p_id bigint, p_sent integer, p_failed integer, p_error text) returns void
language sql security definer set search_path = public as $$
  update mail_log set sent = p_sent, failed = p_failed, error = left(p_error, 500) where id = p_id and public.payment_secret_ok(secret);
$$;
revoke all on function public.mail_claim(text, text, text, text), public.mail_done(text, bigint, integer, integer, text) from public;
grant execute on function public.mail_claim(text, text, text, text), public.mail_done(text, bigint, integer, integer, text) to anon, authenticated;

-- ── 알림 받는 사람 (서버 열쇠로만) ──
--   article_submitted : 그 매체 편집장·발행인 (쓴 사람 빼고) — 기사가 승인신청 상태일 때만
--   article_rejected  : 쓴 기자 — 반려 상태일 때만
--   article_published : 쓴 기자 — 발행 상태일 때만 (편집장이 승인했을 때)
--   ticket_staff_reply: 업무요청을 올린 사람
--   ticket_customer_reply: 담당 매니저 (없으면 총관리자)
--   invoice_issued    : 결제 정보의 담당자 메일 (없으면 그 그룹 발행인)
create or replace function public.mail_recipients(secret text, p_kind text, p_ref uuid)
returns table (email text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_kind = 'article_submitted' then
    return query
      select distinct u.email::text, p.full_name
      from articles a
      join outlets o on o.id = a.outlet_id
      join profiles p on p.id <> a.author_id and coalesce(p.email_notify, true) and (
        (p.role in ('editor', 'admin') and p.outlet_id = a.outlet_id)
        or exists (select 1 from outlet_members m where m.profile_id = p.id and m.outlet_id = a.outlet_id and m.role = 'editor')
        or (p.role = 'admin' and p.publisher_id is not null and p.publisher_id = o.publisher_id))
      join auth.users u on u.id = p.id
      where a.id = p_ref and a.status::text = 'in_review' and u.email is not null;
  elsif p_kind in ('article_rejected', 'article_published') then
    return query
      select u.email::text, p.full_name
      from articles a join profiles p on p.id = a.author_id join auth.users u on u.id = p.id
      where a.id = p_ref and coalesce(p.email_notify, true) and u.email is not null
        and a.status::text = case p_kind when 'article_rejected' then 'rejected' else 'published' end;
  elsif p_kind = 'ticket_staff_reply' then
    return query
      select u.email::text, p.full_name
      from support_tickets t join profiles p on p.id = t.requester_id join auth.users u on u.id = p.id
      where t.id = p_ref and coalesce(p.email_notify, true) and u.email is not null;
  elsif p_kind = 'ticket_customer_reply' then
    return query
      select u.email::text, p.full_name
      from support_tickets t
      join profiles p on (t.assigned_to is not null and p.id = t.assigned_to) or (t.assigned_to is null and coalesce(p.is_super, false))
      join auth.users u on u.id = p.id
      where t.id = p_ref and coalesce(p.email_notify, true) and u.email is not null;
  elsif p_kind = 'invoice_issued' then
    return query
      select b.manager_email, b.manager_name
      from invoices i join outlet_billing b on b.outlet_id = i.outlet_id
      where i.id = p_ref and nullif(trim(b.manager_email), '') is not null
      union
      select u.email::text, p.full_name
      from invoices i join outlets o on o.id = i.outlet_id
      join profiles p on p.role = 'admin' and p.publisher_id = o.publisher_id
      join auth.users u on u.id = p.id
      where i.id = p_ref and u.email is not null
        and not exists (select 1 from outlet_billing b where b.outlet_id = i.outlet_id and nullif(trim(b.manager_email), '') is not null);
  end if;
end $$;
revoke all on function public.mail_recipients(text, text, uuid) from public;
grant execute on function public.mail_recipients(text, text, uuid) to anon, authenticated;

-- ── 뉴스레터 ──
create table if not exists newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  name text check (name is null or char_length(name) <= 60),
  -- pending: 확인 메일을 기다림 / subscribed: 구독 중 / unsubscribed: 수신거부
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  source text not null default 'web' check (source in ('web', 'import')),
  consent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (outlet_id, email)
);
create index if not exists newsletter_subscribers_outlet on newsletter_subscribers(outlet_id, status);
alter table newsletter_subscribers enable row level security;
drop policy if exists "nl_subscribers_manage" on newsletter_subscribers;
create policy "nl_subscribers_manage" on newsletter_subscribers for all to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

create table if not exists newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 150),
  intro text check (intro is null or char_length(intro) <= 3000),
  article_ids uuid[] not null default '{}',
  status text not null default 'sent' check (status in ('sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  failed_count integer not null default 0,
  sent_by uuid default auth.uid() references profiles(id) on delete set null,
  sent_at timestamptz not null default now()
);
alter table newsletter_campaigns enable row level security;
drop policy if exists "nl_campaigns_manage" on newsletter_campaigns;
create policy "nl_campaigns_manage" on newsletter_campaigns for all to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

-- 홈페이지 구독 신청 (우리 서버만 부른다). 이미 구독 중이면 그대로, 수신거부했던 주소는 다시 확인 대기로
--   돌려주는 값: 확인 메일에 넣을 토큰 (이미 구독 중이면 null)
create or replace function public.newsletter_subscribe(secret text, o uuid, p_email text, p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  t text;
  st text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select token, status into t, st from newsletter_subscribers where outlet_id = o and email = lower(trim(p_email));
  if st = 'subscribed' then return null; end if;
  if t is null then
    insert into newsletter_subscribers (outlet_id, email, name, status, consent_at, source)
    values (o, lower(trim(p_email)), nullif(left(trim(p_name), 60), ''), 'pending', now(), 'web') returning token into t;
  else
    update newsletter_subscribers set status = 'pending', consent_at = now(), token = encode(gen_random_bytes(18), 'hex'),
      name = coalesce(nullif(left(trim(p_name), 60), ''), name)
    where outlet_id = o and email = lower(trim(p_email)) returning token into t;
  end if;
  return t;
end $$;
revoke all on function public.newsletter_subscribe(text, uuid, text, text) from public;
grant execute on function public.newsletter_subscribe(text, uuid, text, text) to anon, authenticated;

-- 확인 링크 / 수신거부 링크 (토큰을 아는 사람만). 돌려주는 값: 매체 이름
create or replace function public.newsletter_confirm(p_token text) returns text
language sql security definer set search_path = public as $$
  update newsletter_subscribers s set status = 'subscribed', confirmed_at = now(), unsubscribed_at = null
  where s.token = p_token and s.status = 'pending'
  returning (select name from outlets where id = s.outlet_id);
$$;
create or replace function public.newsletter_unsubscribe(p_token text) returns text
language sql security definer set search_path = public as $$
  update newsletter_subscribers s set status = 'unsubscribed', unsubscribed_at = now()
  where s.token = p_token and s.status <> 'unsubscribed'
  returning (select name from outlets where id = s.outlet_id);
$$;
revoke all on function public.newsletter_confirm(text), public.newsletter_unsubscribe(text) from public;
grant execute on function public.newsletter_confirm(text), public.newsletter_unsubscribe(text) to anon, authenticated;
