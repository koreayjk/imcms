-- ※ 투데이오늘은 뉴스폭탄으로 이름이 바뀌었다. 다시 쓸 일이 있으면 아래 매체 이름을 '뉴스폭탄'으로 고쳐 실행한다
-- 투데이오늘을 "오픈 준비 중"으로 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   도메인으로 들어온 방문자에게는 안내 화면만 보인다. 실제 홈페이지는 홈페이지 설정의 "홈페이지 미리보기" 링크로 본다.
--   정식 오픈하는 날: 홈페이지 설정 → 오픈 준비 중 체크 해제 → 저장 (이날이 개통일, 첫 청구서 발행)
update outlets set site = coalesce(site, '{}'::jsonb) || '{"comingSoon": true}'::jsonb
where name = '투데이오늘';

select name, domain, site->>'comingSoon' as "오픈 준비 중" from outlets where name = '투데이오늘';
