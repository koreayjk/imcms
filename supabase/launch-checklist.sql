-- 고객사 개통 체크리스트 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. staff.sql·groups.sql 다음)
--   고객 상담 → 완료 탭의 개설된 고객사 카드에서 운영팀이 매체마다 개통 작업(도메인·법정 표기·검색 등록 등)을 체크한다
--   항목 목록은 lib/launch-checklist.ts 에 있고, 여기에는 매체별로 끝낸 항목과 시각만 저장한다

create table if not exists launch_checklists (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  done jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table launch_checklists enable row level security;
drop policy if exists "launch_checklists_staff" on launch_checklists;
create policy "launch_checklists_staff" on launch_checklists for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- 확인
select '고객사 개통 체크리스트' as "기능",
  case when to_regclass('public.launch_checklists') is not null then '준비됨' else '아직 안 됨' end as "결과";
