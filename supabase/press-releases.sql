-- 보도자료함 (Supabase SQL 에디터에서 1회 실행)
-- 편집국 계정이 보도자료함을 열면 서버가 RSS를 가져와 여기에 쌓는다

create table if not exists press_releases (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_name text not null,
  guid text not null unique,
  title text not null,
  link text not null,
  summary text,
  body_html text,
  image_url text,
  published_at timestamptz,
  fetched_at timestamptz default now()
);
create index if not exists press_releases_published_idx on press_releases (published_at desc);

create table if not exists press_fetch_log (
  source_key text primary key,
  fetched_at timestamptz not null default now(),
  ok boolean not null,
  message text,
  item_count int not null default 0
);

-- 어떤 보도자료로 만든 기사인지
alter table articles add column if not exists press_release_id uuid references press_releases(id) on delete set null;

alter table press_releases enable row level security;
alter table press_fetch_log enable row level security;

create policy "press_releases_read" on press_releases for select to authenticated using (true);
create policy "press_releases_insert" on press_releases for insert to authenticated with check (true);
create policy "press_releases_update" on press_releases for update to authenticated using (true);

create policy "press_fetch_log_read" on press_fetch_log for select to authenticated using (true);
create policy "press_fetch_log_insert" on press_fetch_log for insert to authenticated with check (true);
create policy "press_fetch_log_update" on press_fetch_log for update to authenticated using (true);
