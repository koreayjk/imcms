-- 개통 진행 현황 허브 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. launch-progress.sql 다음)
--   1) 개통 진행 현황의 단계마다 고객과 운영팀이 코멘트를 주고받는 표
--   2) 고객 상담(신청 접수) 기록 삭제: 총관리자만

create table if not exists launch_comments (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  -- 어느 단계에 대한 글인지 (lib/onboarding-guide.ts 의 단계 id). 비어 있으면 전체 문의
  step_id text,
  author_id uuid references profiles(id) on delete set null,
  author_name text not null default '',
  from_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 2000),
  -- 고객이 쓴 글을 운영팀이 열어 봤는지 (메뉴의 새 글 숫자)
  staff_seen boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists launch_comments_outlet_idx on launch_comments (outlet_id, created_at);
alter table launch_comments enable row level security;

-- 보기: 운영팀, 또는 그 매체를 볼 수 있는 사람(발행인·편집장·기자)
drop policy if exists "launch_comments_select" on launch_comments;
create policy "launch_comments_select" on launch_comments for select to authenticated
  using (public.is_staff() or public.can_view_outlet(outlet_id));
-- 쓰기: 내 이름으로만. 운영팀이 쓰면 운영팀 글, 고객이 쓰면 고객 글로 저장된다
drop policy if exists "launch_comments_insert" on launch_comments;
create policy "launch_comments_insert" on launch_comments for insert to authenticated
  with check (author_id = auth.uid() and from_staff = public.is_staff() and (public.is_staff() or public.can_view_outlet(outlet_id)));
-- 열어 봄 표시·삭제는 운영팀만
drop policy if exists "launch_comments_staff_update" on launch_comments;
create policy "launch_comments_staff_update" on launch_comments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
drop policy if exists "launch_comments_staff_delete" on launch_comments;
create policy "launch_comments_staff_delete" on launch_comments for delete to authenticated
  using (public.is_staff());

-- 고객 상담 기록 삭제 (테스트로 넣은 신청서 등): 총관리자만. 이미 개설한 고객사의 그룹·매체는 지워지지 않는다
drop policy if exists "beta_requests_super_delete" on beta_requests;
create policy "beta_requests_super_delete" on beta_requests for delete to authenticated
  using (public.is_super());

-- 확인
select '개통 진행 현황 코멘트' as "기능",
  case when to_regclass('public.launch_comments') is not null then '준비됨' else '아직 안 됨' end as "결과";
