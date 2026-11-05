-- 미래농업매거진 샘플 기사 지우기 (이관이 끝나고 진짜 기사를 올린 뒤에 Supabase SQL 에디터에서 실행)
--   샘플은 2026-11-05에 IM 체험뉴스 기사 88건을 복사해 넣었다. 표시 두 가지:
--     · 제목이 "[샘플] "로 시작
--     · ai_notes 에 "[sample-copy:원본기사id]" (원본은 IM 체험뉴스 기사, 그쪽은 건드리지 않았다)
--   기자명은 "샘플 기자". 이 둘이 모두 맞는 기사만 지우므로, 이관한 진짜 기사나 직접 쓴 기사는 지워지지 않는다.
--   (articles.is_sample 은 쓰지 않았다: 그 표시는 체험 전용이라 편집·삭제가 막힌다.)

-- 1) 먼저 몇 건인지 확인
select count(*) as samples
from articles
where outlet_id = '020d226e-edea-4e08-a7d9-ba45bffba46d'
  and title like '[샘플] %' and ai_notes like '%[sample-copy:%';

-- 2) 지우기 (위 건수가 맞을 때만. 홈 편집판에 고정한 샘플은 자리가 비면 자동으로 최신 기사로 채워진다)
-- delete from articles
-- where outlet_id = '020d226e-edea-4e08-a7d9-ba45bffba46d'
--   and title like '[샘플] %' and ai_notes like '%[sample-copy:%';
