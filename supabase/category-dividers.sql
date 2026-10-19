-- 홈페이지 메뉴 구분선 (Supabase SQL 에디터에서 실행)
--   카테고리 관리에서 넣은 구분선 자리: 이 카테고리 앞(왼쪽)에 세로 구분선을 그린다
--   비어 있으면(null) 예전처럼 전문 섹션이 시작되는 자리에만 구분선을 그린다
alter table public.categories add column if not exists divider_before boolean;
