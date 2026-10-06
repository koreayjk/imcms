-- 새 SQL 실행 여부 확인 (읽기만 한다. Supabase SQL 에디터에 붙여 넣고 Run)
--   '실행됨'이 아니면 그 파일을 실행해 주세요
select 'billing-dunning.sql (미납 처리)' as "파일",
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'outlets' and column_name = 'billing_hold')
        and to_regprocedure('public.billing_dunning(text)') is not null
        and exists (select 1 from pg_trigger where tgname = 'billing_hold_guard' and not tgisinternal)
       then '실행됨' else '아직 안 됨' end as "결과"
union all
select 'staff-site.sql (매니저 고객사 수정·기사 쓰기 잠금)',
  case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'articles' and policyname = 'articles_select_staff')
        and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'articles' and policyname = 'articles_insert'
                    and with_check like '%source_article_id%')
       then '실행됨' else '아직 안 됨' end;
