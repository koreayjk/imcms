-- IM CMS 초기 스키마 (v0.1)
-- 기자 -> 편집장 승인 워크플로우를 핵심으로 설계

create type user_role as enum ('reporter', 'editor', 'admin');
create type article_status as enum ('draft', 'in_review', 'published', 'rejected');

-- 사용자 프로필 (Supabase auth.users 확장)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'reporter',
  outlet_id uuid, -- 어느 언론사 소속인지 (다매체 운영 대비)
  created_at timestamptz default now()
);

-- 언론사(매체) — 조건호님이 여러 매체를 인수할 예정이므로 처음부터 다매체 구조로
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
  category_id uuid references categories(id),
  author_id uuid references profiles(id) not null,
  title text not null,
  body text not null,
  status article_status not null default 'draft',
  reviewed_by uuid references profiles(id),
  reject_reason text,
  published_at timestamptz,
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

-- Row Level Security: 기자는 본인 글만, 편집장/관리자는 소속 매체 전체
alter table articles enable row level security;

create policy "기자는 본인 글 조회/수정"
  on articles for all
  using (author_id = auth.uid());

create policy "편집장/관리자는 소속 매체 전체 조회"
  on articles for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('editor', 'admin')
      and profiles.outlet_id = articles.outlet_id
    )
  );

create policy "편집장/관리자는 소속 매체 전체 승인/반려"
  on articles for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role in ('editor', 'admin')
      and profiles.outlet_id = articles.outlet_id
    )
  );
