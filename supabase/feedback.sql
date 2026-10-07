-- 개선 요청: 기자·편집장이 편집국 프로그램에 바라는 점을 올리고, 운영팀이 상태(접수·처리중·이미 있음·처리완료·반영 어려움)를 정하고 댓글로 의견을 나눈다
--   (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. support.sql·groups.sql 다음)
--   보기: 쓴 사람은 자기 글만, 운영팀(총관리자·IM 뉴스룸 매니저)은 전체
--   상태 바꾸기: 운영팀 / 글·댓글 고치기·지우기: 쓴 사람과 총관리자

create table if not exists feedback_posts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete set null,
  author_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  author_name text,
  category text not null default 'improve' check (category in ('improve', 'bug', 'new', 'etc')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 5000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'exists', 'done', 'declined')),
  status_by uuid references profiles(id) on delete set null,
  status_at timestamptz,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists feedback_posts_list on feedback_posts (status, created_at desc);
create index if not exists feedback_posts_outlet on feedback_posts (outlet_id, created_at desc);

create table if not exists feedback_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feedback_posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  author_name text,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists feedback_comments_post on feedback_comments (post_id, created_at);

-- 이 글을 볼 수 있는가
create or replace function public.can_see_feedback(p uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from feedback_posts f
    where f.id = p and (public.is_staff() or f.author_id = auth.uid())
  );
$$;
grant execute on function public.can_see_feedback(uuid) to authenticated;

-- 글: 쓴 사람·매체·이름은 DB가 정하고, 상태는 운영팀만, 제목·내용은 쓴 사람과 총관리자만 바꾼다
create or replace function public.feedback_post_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.outlet_id := public.my_outlet();
    new.author_name := (select nullif(full_name, '') from profiles where id = auth.uid());
    new.status := 'received';
    new.status_by := null;
    new.status_at := null;
    new.comment_count := 0;
    new.created_at := now();
    new.updated_at := now();
    new.edited_at := null;
    return new;
  end if;
  new.id := old.id;
  new.author_id := old.author_id;
  new.outlet_id := old.outlet_id;
  new.author_name := old.author_name;
  new.created_at := old.created_at;
  -- 댓글 수는 댓글 트리거만 바꾼다 (그 트리거는 app.feedback_count 를 켜 둔다)
  if coalesce(current_setting('app.feedback_count', true), '') <> 'on' then
    new.comment_count := old.comment_count;
  end if;
  if not (old.author_id = auth.uid() or public.is_super()) then
    new.title := old.title;
    new.body := old.body;
    new.category := old.category;
  end if;
  if not public.is_staff() then
    new.status := old.status;
    new.status_by := old.status_by;
    new.status_at := old.status_at;
  elsif new.status is distinct from old.status then
    new.status_by := auth.uid();
    new.status_at := now();
  else
    new.status_by := old.status_by;
    new.status_at := old.status_at;
  end if;
  if new.title is distinct from old.title or new.body is distinct from old.body or new.category is distinct from old.category then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists feedback_post_guard on feedback_posts;
create trigger feedback_post_guard before insert or update on feedback_posts for each row execute function public.feedback_post_guard();

-- 댓글: 운영팀 표시·이름은 DB가 정한다. 고칠 수 있는 건 내용뿐
create or replace function public.feedback_comment_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.is_staff := public.is_staff();
    new.author_name := (select nullif(full_name, '') from profiles where id = auth.uid());
    new.created_at := now();
    new.edited_at := null;
    return new;
  end if;
  new.id := old.id;
  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.author_name := old.author_name;
  new.is_staff := old.is_staff;
  new.created_at := old.created_at;
  new.edited_at := case when new.body is distinct from old.body then now() else old.edited_at end;
  return new;
end $$;
drop trigger if exists feedback_comment_guard on feedback_comments;
create trigger feedback_comment_guard before insert or update on feedback_comments for each row execute function public.feedback_comment_guard();

-- 댓글 수 맞추기
create or replace function public.feedback_comment_count() returns trigger language plpgsql security definer set search_path = public as $$
declare p uuid := coalesce(new.post_id, old.post_id);
begin
  perform set_config('app.feedback_count', 'on', true);
  update feedback_posts set comment_count = (select count(*) from feedback_comments where post_id = p) where id = p;
  perform set_config('app.feedback_count', 'off', true);
  return null;
end $$;
drop trigger if exists feedback_comment_count on feedback_comments;
create trigger feedback_comment_count after insert or delete on feedback_comments for each row execute function public.feedback_comment_count();

alter table feedback_posts enable row level security;
drop policy if exists "feedback_posts_select" on feedback_posts;
create policy "feedback_posts_select" on feedback_posts for select to authenticated
  using (public.is_staff() or author_id = auth.uid());
drop policy if exists "feedback_posts_insert" on feedback_posts;
create policy "feedback_posts_insert" on feedback_posts for insert to authenticated with check (true);
drop policy if exists "feedback_posts_update" on feedback_posts;
create policy "feedback_posts_update" on feedback_posts for update to authenticated
  using (author_id = auth.uid() or public.is_staff()) with check (author_id = auth.uid() or public.is_staff());
drop policy if exists "feedback_posts_delete" on feedback_posts;
create policy "feedback_posts_delete" on feedback_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_super());

alter table feedback_comments enable row level security;
drop policy if exists "feedback_comments_select" on feedback_comments;
create policy "feedback_comments_select" on feedback_comments for select to authenticated using (public.can_see_feedback(post_id));
drop policy if exists "feedback_comments_insert" on feedback_comments;
create policy "feedback_comments_insert" on feedback_comments for insert to authenticated with check (public.can_see_feedback(post_id));
drop policy if exists "feedback_comments_update" on feedback_comments;
create policy "feedback_comments_update" on feedback_comments for update to authenticated
  using (author_id = auth.uid() or public.is_super()) with check (author_id = auth.uid() or public.is_super());
drop policy if exists "feedback_comments_delete" on feedback_comments;
create policy "feedback_comments_delete" on feedback_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_super());

-- 승인 전 가입자·정지·2단계 인증·끊긴 로그인 확인도 겹쳐 건다 (그 SQL을 실행한 DB만)
do $$
declare t text;
begin
  foreach t in array array['feedback_posts', 'feedback_comments'] loop
    if to_regprocedure('public.is_approved()') is not null then
      execute format('drop policy if exists "approved_only" on public.%I', t);
      execute format('create policy "approved_only" on public.%I as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved())', t);
    end if;
    if to_regprocedure('public.session_ok()') is not null then
      execute format('drop policy if exists "zz_account_ok" on public.%I', t);
      execute format('create policy "zz_account_ok" on public.%I as restrictive for all to authenticated using (public.session_ok()) with check (public.session_ok())', t);
    end if;
  end loop;
end $$;

-- 확인: 표 두 개가 보이면 끝
select table_name as "만든 표" from information_schema.tables
where table_schema = 'public' and table_name in ('feedback_posts', 'feedback_comments') order by 1;
