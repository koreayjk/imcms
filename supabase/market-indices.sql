-- 해운 운임지수 위젯 (SCFI·KCCI 주간 값) — Supabase SQL 에디터에서 실행 (outlet-members.sql 다음)
--   매체마다 편집장 이상이 매주 발표된 값을 입력하고, 홈페이지 오른쪽에 그래프로 보여준다
--   SCFI: 상하이해운거래소(SSE) 매주 금요일 발표 / KCCI: 한국해양진흥공사(KOBC) 매주 월요일 발표
--   위젯은 "홈페이지 설정"에서 켠 매체에만 나온다 (site.indexWidget)

create table if not exists market_index_points (
  outlet_id uuid not null references outlets(id) on delete cascade,
  index_key text not null check (index_key in ('scfi', 'kcci')),
  week_date date not null,
  value numeric(10, 2) not null check (value > 0 and value < 100000),
  -- 테스트용 샘플 값 (홈페이지에 "샘플" 표시가 붙는다)
  is_sample boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (outlet_id, index_key, week_date)
);

alter table market_index_points enable row level security;

-- 보기: 누구나 (홈페이지에 공개되는 값)
drop policy if exists "market_index_points_read" on market_index_points;
create policy "market_index_points_read" on market_index_points for select to anon, authenticated using (true);

-- 입력·수정·삭제: 그 매체의 편집장·발행인·총관리자 (매니저도 도울 수 있게)
drop policy if exists "market_index_points_write" on market_index_points;
create policy "market_index_points_write" on market_index_points for all to authenticated
  using (public.can_manage_outlet(outlet_id) or public.is_staff())
  with check (public.can_manage_outlet(outlet_id) or public.is_staff());
