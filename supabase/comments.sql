-- 기사 댓글 1단계 (Supabase SQL 에디터에서 실행, mail.sql(payment_secret_ok) 다음. 여러 번 실행해도 된다)
--   · 댓글 방식은 매체 설정(site.commentsOn / site.commentsKind)으로 고른다: 없음 / 'guest' = 닉네임·비밀번호·그림 문자 입력 / 'login' = 독자 로그인(구글·이메일 링크)
--     독자 로그인 계정은 편집국 회원(profiles)과 완전히 별개다
--   · 새 댓글 처리는 매체 설정(site.commentsMode)으로 고른다: 'review' = 승인 후 공개(기본), 'open' = 먼저 공개하고 나중에 검토
--     'open' 이어도 자동 검사(링크·욕설·연락처·고함·도배)에 걸린 댓글은 승인 대기로 잡아 둔다 (hold_reason)
--   · 신고가 3건 쌓이면 자동으로 다시 "승인 대기"로 돌려 숨긴다
--   · 댓글 켜기·끄기는 홈페이지 설정(site.commentsOn)에서. 기본은 꺼짐
--   · 독자 쪽 쓰기·읽기는 우리 서버만 비밀값(payment_db_secret)으로 부른다. 표는 직접 읽고 쓸 수 없다

create table if not exists readers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  name text check (name is null or char_length(name) <= 60),
  provider text not null default 'email' check (provider in ('email', 'google')),
  banned boolean not null default false,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table readers enable row level security;
-- 편집국: 편집장 이상은 자기 매체에 댓글을 쓴 독자만 (이름·이메일) 볼 수 있다
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  article_id uuid not null references articles(id) on delete cascade,
  reader_id uuid not null references readers(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  hold_reason text,
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null
);
alter table comments add column if not exists hold_reason text;
create index if not exists comments_article on comments (article_id, status, created_at);
create index if not exists comments_outlet on comments (outlet_id, status, created_at desc);
alter table comments enable row level security;
drop policy if exists "comments_manage" on comments;
create policy "comments_manage" on comments for all to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));
drop policy if exists "readers_manage" on readers;
create policy "readers_manage" on readers for select to authenticated
  using (coalesce(public.is_staff(), false) or exists (select 1 from comments c where c.reader_id = readers.id and coalesce(public.can_manage_outlet(c.outlet_id), false)));
drop policy if exists "readers_ban" on readers;
create policy "readers_ban" on readers for update to authenticated
  using (coalesce(public.is_staff(), false) or exists (select 1 from comments c where c.reader_id = readers.id and coalesce(public.can_manage_outlet(c.outlet_id), false)))
  with check (true);

create table if not exists comment_reports (
  comment_id uuid not null references comments(id) on delete cascade,
  reader_id uuid not null references readers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, reader_id)
);
alter table comment_reports enable row level security;

-- 독자 로그인(이메일 확인 / 구글) 뒤 독자 계정 만들기·찾기. 돌려주는 값: 독자 번호 (차단된 독자는 null)
create or replace function public.reader_upsert(secret text, p_email text, p_name text, p_provider text) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid; b boolean;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  insert into readers (email, name, provider) values (lower(trim(p_email)), nullif(left(trim(p_name), 60), ''), case when p_provider = 'google' then 'google' else 'email' end)
  on conflict (email) do update set last_seen_at = now(), name = coalesce(nullif(left(trim(p_name), 60), ''), readers.name)
  returning id, banned into rid, b;
  return case when b then null else rid end;
end $$;
revoke all on function public.reader_upsert(text, text, text, text) from public;
grant execute on function public.reader_upsert(text, text, text, text) to anon, authenticated;

-- 쿠키 속 독자 번호가 아직 유효한가 (차단되지 않았나). 돌려주는 값: 독자 이름(없으면 이메일 앞부분), 차단·없음이면 null
create or replace function public.reader_get(secret text, rid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select coalesce(name, split_part(email, '@', 1)) into n from readers where id = rid and not banned;
  return n;
end $$;
revoke all on function public.reader_get(text, uuid) from public;
grant execute on function public.reader_get(text, uuid) to anon, authenticated;

-- 승인된 댓글 (홈페이지 기사 아래). 이름은 독자 이름, 없으면 이메일 앞부분의 앞 3글자 + ***
create or replace function public.comments_public(secret text, p_article uuid) returns table (id uuid, name text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query
    select c.id, coalesce(r.name, left(split_part(r.email, '@', 1), 3) || '***'), c.body, c.created_at
    from comments c join readers r on r.id = c.reader_id
    where c.article_id = p_article and c.status = 'approved'
    order by c.created_at limit 200;
end $$;
revoke all on function public.comments_public(text, uuid) from public;
grant execute on function public.comments_public(text, uuid) to anon, authenticated;

-- 댓글 쓰기. p_hold: 자동 검사에 걸린 이유(없으면 null) — 걸리면 어느 설정이든 승인 대기.
--   돌려주는 값: 'ok' (승인 대기로 받음) / 'live' (바로 공개됨, 먼저 공개 설정) / 'banned' / 'rate' (1분 안에 3개 넘음) / 'dup' (같은 글 반복) / 'off' (이 매체 댓글 꺼짐) / 'closed' (없는 기사)
drop function if exists public.comment_add(text, uuid, uuid, text);
create or replace function public.comment_add(secret text, rid uuid, p_article uuid, p_body text, p_hold text default null) returns text
language plpgsql security definer set search_path = public as $$
declare o uuid; on_flag text; mode text; b text := btrim(p_body); st text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if exists (select 1 from readers where id = rid and banned) then return 'banned'; end if;
  select a.outlet_id into o from articles a where a.id = p_article and a.status = 'published';
  if o is null then return 'closed'; end if;
  select coalesce(site->>'commentsOn', 'false'), coalesce(site->>'commentsMode', 'review') into on_flag, mode from outlets where id = o;
  if on_flag <> 'true' then return 'off'; end if;
  if (select count(*) from comments where reader_id = rid and created_at > now() - interval '1 minute') >= 3 then return 'rate'; end if;
  if exists (select 1 from comments where reader_id = rid and article_id = p_article and body = b and created_at > now() - interval '1 day') then return 'dup'; end if;
  st := case when p_hold is null and mode = 'open' then 'approved' else 'pending' end;
  insert into comments (outlet_id, article_id, reader_id, body, status, hold_reason) values (o, p_article, rid, left(b, 1000), st, nullif(left(p_hold, 40), ''));
  return case when st = 'approved' then 'live' else 'ok' end;
end $$;
revoke all on function public.comment_add(text, uuid, uuid, text, text) from public;
grant execute on function public.comment_add(text, uuid, uuid, text, text) to anon, authenticated;

-- 로그인한 독자의 이메일 (뉴스레터 구독 신청에 쓴다. 차단된 독자는 null)
create or replace function public.reader_email(secret text, rid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare e text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select email into e from readers where id = rid and not banned;
  return e;
end $$;
revoke all on function public.reader_email(text, uuid) from public;
grant execute on function public.reader_email(text, uuid) to anon, authenticated;

-- 신고 (독자마다 댓글 하나에 한 번). 3건이면 승인 대기로 돌려 숨긴다
create or replace function public.comment_report(secret text, rid uuid, p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  insert into comment_reports (comment_id, reader_id) values (p_comment, rid) on conflict do nothing;
  select count(*) into n from comment_reports where comment_id = p_comment;
  update comments set report_count = n, status = case when n >= 3 and status = 'approved' then 'pending' else status end where id = p_comment;
end $$;
revoke all on function public.comment_report(text, uuid, uuid) from public;
grant execute on function public.comment_report(text, uuid, uuid) to anon, authenticated;

-- ───────── 비회원(닉네임·비밀번호) 댓글 ─────────
alter table comments alter column reader_id drop not null;
alter table comments add column if not exists guest_name text check (guest_name is null or char_length(guest_name) <= 30);
alter table comments add column if not exists guest_pw text;       -- scrypt 해시 (salt:hash). 본인 댓글 지우기용
alter table comments add column if not exists ip_hash text;        -- 접속 주소를 비밀값과 섞어 한쪽으로만 바꾼 값 (도배·차단용, 원래 주소는 저장하지 않는다)
create index if not exists comments_ip on comments (ip_hash, created_at);

-- 차단한 비회원 (매체별)
create table if not exists comment_blocked_ips (
  outlet_id uuid not null references outlets(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  primary key (outlet_id, ip_hash)
);
alter table comment_blocked_ips enable row level security;
drop policy if exists "blocked_ips_manage" on comment_blocked_ips;
create policy "blocked_ips_manage" on comment_blocked_ips for all to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

-- 신고: 로그인 독자는 독자 번호, 비회원은 ip 표시로 한 번씩
alter table comment_reports add column if not exists reporter_key text;
update comment_reports set reporter_key = reader_id::text where reporter_key is null;
alter table comment_reports alter column reader_id drop not null;
alter table comment_reports drop constraint if exists comment_reports_pkey;
create unique index if not exists comment_reports_key on comment_reports (comment_id, reporter_key);
drop function if exists public.comment_report(text, uuid, uuid);
create or replace function public.comment_report(secret text, p_key text, p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  insert into comment_reports (comment_id, reporter_key) values (p_comment, left(p_key, 80)) on conflict do nothing;
  select count(*) into n from comment_reports where comment_id = p_comment;
  update comments set report_count = n, status = case when n >= 3 and status = 'approved' then 'pending' else status end where id = p_comment;
end $$;
revoke all on function public.comment_report(text, text, uuid) from public;
grant execute on function public.comment_report(text, text, uuid) to anon, authenticated;

-- 승인된 댓글 (로그인 독자·비회원 모두). can_delete: 비회원이 쓴 댓글이면 비밀번호로 지울 수 있다
drop function if exists public.comments_public(text, uuid);
create or replace function public.comments_public(secret text, p_article uuid) returns table (id uuid, name text, body text, created_at timestamptz, guest boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query
    select c.id, coalesce(r.name, c.guest_name, left(split_part(r.email, '@', 1), 3) || '***'), c.body, c.created_at, (c.reader_id is null)
    from comments c left join readers r on r.id = c.reader_id
    where c.article_id = p_article and c.status = 'approved'
    order by c.created_at limit 200;
end $$;
revoke all on function public.comments_public(text, uuid) from public;
grant execute on function public.comments_public(text, uuid) to anon, authenticated;

-- 비회원 댓글 쓰기. p_pw: 해시(salt:hash), p_hold: 자동 검사 이유, p_ip: 접속 표시값
--   돌려주는 값: 'ok' / 'live' / 'banned' / 'rate' / 'dup' / 'off' / 'mode' (이 매체는 비회원 댓글을 받지 않음) / 'closed'
create or replace function public.comment_add_guest(secret text, p_article uuid, p_name text, p_pw text, p_body text, p_hold text, p_ip text) returns text
language plpgsql security definer set search_path = public as $$
declare o uuid; on_flag text; kind text; mode text; b text := btrim(p_body); st text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select a.outlet_id into o from articles a where a.id = p_article and a.status = 'published';
  if o is null then return 'closed'; end if;
  select coalesce(site->>'commentsOn', 'false'), coalesce(site->>'commentsKind', 'login'), coalesce(site->>'commentsMode', 'review') into on_flag, kind, mode from outlets where id = o;
  if on_flag <> 'true' then return 'off'; end if;
  if kind <> 'guest' then return 'mode'; end if;
  if exists (select 1 from comment_blocked_ips where outlet_id = o and ip_hash = p_ip) then return 'banned'; end if;
  if (select count(*) from comments where ip_hash = p_ip and created_at > now() - interval '1 minute') >= 3 then return 'rate'; end if;
  if (select count(*) from comments where ip_hash = p_ip and created_at > now() - interval '1 hour') >= 20 then return 'rate'; end if;
  if exists (select 1 from comments where ip_hash = p_ip and article_id = p_article and body = b and created_at > now() - interval '1 day') then return 'dup'; end if;
  st := case when p_hold is null and mode = 'open' then 'approved' else 'pending' end;
  insert into comments (outlet_id, article_id, reader_id, guest_name, guest_pw, ip_hash, body, status, hold_reason)
  values (o, p_article, null, left(btrim(p_name), 30), p_pw, p_ip, left(b, 500), st, nullif(left(p_hold, 40), ''));
  return case when st = 'approved' then 'live' else 'ok' end;
end $$;
revoke all on function public.comment_add_guest(text, uuid, text, text, text, text, text) from public;
grant execute on function public.comment_add_guest(text, uuid, text, text, text, text, text) to anon, authenticated;

-- 비회원 댓글을 지울 때: 저장된 비밀번호 해시를 서버가 받아 비교하고, 맞으면 지운다
create or replace function public.comment_guest_hash(secret text, p_comment uuid) returns text
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select guest_pw into h from comments where id = p_comment and reader_id is null;
  return h;
end $$;
revoke all on function public.comment_guest_hash(text, uuid) from public;
grant execute on function public.comment_guest_hash(text, uuid) to anon, authenticated;
create or replace function public.comment_guest_delete(secret text, p_comment uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  delete from comments where id = p_comment and reader_id is null;
end $$;
revoke all on function public.comment_guest_delete(text, uuid) from public;
grant execute on function public.comment_guest_delete(text, uuid) to anon, authenticated;

select 'comments' as 표, count(*) as 건수 from comments union all select 'readers', count(*) from readers;
