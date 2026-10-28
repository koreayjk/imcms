-- 기사 저장 때 "infinite recursion detected in policy for relation articles" 가 나올 때 원인 찾기 (읽기만 하는 조회, 아무것도 바꾸지 않는다)
--   Supabase SQL 에디터에서 실행하고, 나온 표를 그대로 캡처해서 알려 주세요.
--   ① articles 표에 걸린 모든 권한 규칙  ② 다른 표의 규칙 중 articles 를 다시 읽는 것(서로 돌고 도는 원인)  ③ articles 에 걸린 트리거
select '① articles 규칙' as 구분, policyname::text as 이름, cmd::text as 종류, permissive::text as 허용방식,
       left(coalesce(qual, '') || ' || ' || coalesce(with_check, ''), 400) as 내용
from pg_policies where schemaname = 'public' and tablename = 'articles'
union all
select '② articles 를 읽는 다른 표 규칙', tablename || '.' || policyname, cmd::text, permissive::text,
       left(coalesce(qual, '') || ' || ' || coalesce(with_check, ''), 400)
from pg_policies where schemaname = 'public' and tablename <> 'articles'
  and (coalesce(qual, '') ilike '%articles%' or coalesce(with_check, '') ilike '%articles%')
union all
select '③ articles 트리거', tgname::text, '', '', left(pg_get_triggerdef(oid), 300)
from pg_trigger where tgrelid = 'public.articles'::regclass and not tgisinternal
order by 1, 2;
