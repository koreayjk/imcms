-- IM 뉴스룸 서비스 신청서 (Supabase SQL 에디터에서 실행, beta-requests.sql·staff.sql 다음)
--   소개 페이지 신청서에서 고른 요금제·결제 방식·도메인과 이용약관 동의 기록을 남긴다
--   실행 전에도 신청서는 받아진다 (이 칸들 없이 저장하고, 요금제는 요청사항에 함께 적어 둔다)

alter table beta_requests add column if not exists plan text
  check (plan is null or plan in ('basic', 'standard', 'premium', 'enterprise'));
alter table beta_requests add column if not exists billing text
  check (billing is null or billing in ('monthly', 'annual'));
alter table beta_requests add column if not exists domain text
  check (domain is null or char_length(domain) <= 120);
-- 이용약관 동의 시각과 그때의 약관 판(시행일)
alter table beta_requests add column if not exists terms_agreed_at timestamptz;
alter table beta_requests add column if not exists terms_version text
  check (terms_version is null or char_length(terms_version) <= 20);
-- 신청 당시 안내한 첫 결제 금액(VAT 포함)과 베타 할인 적용 여부 — 나중에 요금이 바뀌어도 신청 때 금액을 알 수 있게
alter table beta_requests add column if not exists quoted_total integer check (quoted_total is null or quoted_total between 0 and 100000000);
alter table beta_requests add column if not exists beta_discount boolean;
