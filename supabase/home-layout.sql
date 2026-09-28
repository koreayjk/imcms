-- 홈 편집판: 매체별 홈페이지 기사 배치 (Supabase SQL 에디터에서 1회 실행)
-- layout 예: {"headline": ["기사id"], "top": ["id", null], "major": [...6], "pick": [...4]}
-- 비어 있는 자리는 홈페이지가 최신 기사로 자동 배치한다

create table if not exists home_layouts (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  layout jsonb not null default '{}',
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

alter table home_layouts enable row level security;

create policy "home_layouts_select_public" on home_layouts for select to anon, authenticated using (true);

create policy "home_layouts_insert" on home_layouts for insert to authenticated
  with check (exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or (role = 'editor' and outlet_id = home_layouts.outlet_id))
  ));

create policy "home_layouts_update" on home_layouts for update to authenticated
  using (exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or (role = 'editor' and outlet_id = home_layouts.outlet_id))
  ));
