-- IM CMS 스키마 (v0.2)
-- 기자 -> 편집장 승인 워크플로우 + 다매체 운영

create type user_role as enum ('reporter', 'editor', 'admin');
create type article_status as enum ('draft', 'in_review', 'published', 'rejected');

-- 사용자 프로필 (Supabase auth.users 확장)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'reporter',
  outlet_id uuid,
  created_at timestamptz default now()
);

-- 언론사(매체) — 다매체 운영 대비
create table outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order int default 0
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  author_id uuid references profiles(id) not null,
  title text not null,
  body text not null default '',
  excerpt text,
  thumbnail_url text,
  status article_status not null default 'draft',
  is_featured boolean not null default false,
  reviewed_by uuid references profiles(id),
  reject_reason text,
  published_at timestamptz,
  scheduled_at timestamptz,
  tags text[],
  meta_title text,
  meta_description text,
  view_count int not null default 0,
  source_article_id uuid references articles(id) on delete set null,
  syndicate_to uuid[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  article_id uuid references articles(id) on delete cascade,
  url text not null,
  alt_text text,
  created_at timestamptz default now()
);

-- updated_at 자동 갱신 트리거
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger articles_updated_at
  before update on articles
  for each row execute function set_updated_at();

-- 신규 사용자 가입 시 프로필 자동 생성
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'reporter'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Row Level Security
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

alter table profiles enable row level security;
alter table outlets enable row level security;
alter table categories enable row level security;
alter table articles enable row level security;
alter table media_assets enable row level security;

-- profiles
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update_own" on profiles for update to authenticated using (id = auth.uid());
create policy "profiles_update_admin" on profiles for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 권한(role)·소속(outlet_id)은 관리자만 변경 가능 (SQL 에디터에서는 auth.uid()가 없어 허용)
create or replace function protect_profile_fields()
returns trigger as $$
begin
  if (new.role is distinct from old.role or new.outlet_id is distinct from old.outlet_id)
     and auth.uid() is not null
     and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  then
    raise exception '권한 또는 소속은 관리자만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_protect_fields
  before update on profiles
  for each row execute function protect_profile_fields();

-- outlets
create policy "outlets_select" on outlets for select to authenticated using (true);
create policy "outlets_insert" on outlets for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "outlets_update" on outlets for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- categories: 편집장/관리자 CUD
create policy "categories_select" on categories for select to authenticated using (true);
create policy "categories_insert" on categories for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin')));
create policy "categories_update" on categories for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin')));
create policy "categories_delete" on categories for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin')));

-- articles: 기자는 본인 글, 편집장/관리자는 전체
create policy "articles_select" on articles for select to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );

create policy "articles_insert" on articles for insert to authenticated
  with check (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );

create policy "articles_update" on articles for update to authenticated
  using (
    author_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role in ('editor', 'admin'))
  );

create policy "articles_delete" on articles for delete to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- media_assets
create policy "media_assets_select" on media_assets for select to authenticated using (true);
create policy "media_assets_insert" on media_assets for insert to authenticated with check (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 공개 신문 사이트용 익명(anon) 읽기 권한
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 발행된 기사는 로그인 없이 누구나 읽을 수 있음
create policy "public_articles_select" on articles for select to anon
  using (status = 'published');

-- 카테고리·매체·작성자 정보도 공개
create policy "public_categories_select" on categories for select to anon using (true);
create policy "public_outlets_select"    on outlets    for select to anon using (true);
create policy "public_profiles_select"   on profiles   for select to anon using (true);
create policy "public_media_select"      on media_assets for select to anon using (true);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 초기 데이터 예시 (Supabase SQL 에디터에서 직접 실행)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- insert into outlets (name, domain) values ('뉴미디어타임즈', 'newmdtimes.com');
