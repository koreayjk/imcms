-- 기사 댓글 1단계 (Supabase SQL 에디터에서 실행, mail.sql(payment_secret_ok) 다음. 여러 번 실행해도 된다)
--   · 독자는 구글·이메일 링크로 로그인해야 댓글을 쓸 수 있다 (독자 계정은 편집국 회원(profiles)과 완전히 별개다)
--   · 새 댓글은 모두 "승인 대기": 편집국(편집장 이상)이 승인해야 홈페이지에 보인다
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
  report_count integer not null default 0,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references profiles(id) on delete set null
);
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

-- 댓글 쓰기: 항상 승인 대기. 돌려주는 값: 'ok' / 'banned' / 'rate' (1분 안에 3개 넘음) / 'dup' (같은 글 반복) / 'off' (이 매체 댓글 꺼짐) / 'closed' (없는 기사)
create or replace function public.comment_add(secret text, rid uuid, p_article uuid, p_body text) returns text
language plpgsql security definer set search_path = public as $$
declare o uuid; on_flag text; b text := btrim(p_body);
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if exists (select 1 from readers where id = rid and banned) then return 'banned'; end if;
  select a.outlet_id into o from articles a where a.id = p_article and a.status = 'published';
  if o is null then return 'closed'; end if;
  select coalesce(site->>'commentsOn', 'false') into on_flag from outlets where id = o;
  if on_flag <> 'true' then return 'off'; end if;
  if (select count(*) from comments where reader_id = rid and created_at > now() - interval '1 minute') >= 3 then return 'rate'; end if;
  if exists (select 1 from comments where reader_id = rid and article_id = p_article and body = b and created_at > now() - interval '1 day') then return 'dup'; end if;
  insert into comments (outlet_id, article_id, reader_id, body) values (o, p_article, rid, left(b, 1000));
  return 'ok';
end $$;
revoke all on function public.comment_add(text, uuid, uuid, text) from public;
grant execute on function public.comment_add(text, uuid, uuid, text) to anon, authenticated;

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

select 'comments' as 표, count(*) as 건수 from comments union all select 'readers', count(*) from readers;
