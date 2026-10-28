-- 기사 저장 오류 원인 찾기 2차 (읽기만 하는 조회, 아무것도 바꾸지 않는다)
--   Supabase SQL 에디터에서 실행하고 나온 표를 캡처해서 알려 주세요.
--   ① 기사 규칙·트리거가 쓰는 함수가 "정의자 권한(definer)"인지 "호출자 권한(invoker)"인지와 내용 앞부분
--   ② profiles·outlets 표에 걸린 규칙 (기사 규칙에서 이 표들을 거쳐 다시 기사로 돌아오는 고리가 있는지 확인)
select '① 함수' as 구분, p.proname::text as 이름,
       case when p.prosecdef then 'definer' else 'invoker' end as 권한,
       left(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g'), 700) as 내용
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'is_approved', 'session_ok', 'my_outlet', 'my_publisher', 'outlet_publisher', 'can_manage_outlet', 'manageable_outlets',
  'is_staff', 'is_super', 'billing_hold_guard', 'trial_article_guard', 'trial_moderation_guard',
  'articles_byline_email', 'articles_fill_byline', 'record_article_revision', 'set_updated_at')
union all
select '② 규칙', tablename || '.' || policyname, cmd::text || ' / ' || permissive::text || ' / ' || array_to_string(roles, ','),
       left(coalesce(qual, '') || ' || ' || coalesce(with_check, ''), 500)
from pg_policies where schemaname = 'public' and tablename in ('profiles', 'outlets')
order by 1, 2;
