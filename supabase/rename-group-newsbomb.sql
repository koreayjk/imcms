-- 그룹 이름 투데이오늘 → 뉴스폭탄 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   회원 관리의 "투데이오늘 2명", "그룹 전체: 투데이오늘" 에 나오는 이름이 그룹(publishers) 이름이다
update publishers set name = '뉴스폭탄'
where name = '투데이오늘' and not exists (select 1 from publishers where name = '뉴스폭탄');

select id, name from publishers order by created_at;
