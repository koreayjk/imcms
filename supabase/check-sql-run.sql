-- 최근 SQL 실행 여부 확인 (읽기만 한다. Supabase SQL 에디터에 붙여 넣고 Run)
--   '실행됨'이 아니면 그 파일을 실행해 주세요
select * from (
select '1. billing-dunning.sql (미납 처리)' as "파일",
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'outlets' and column_name = 'billing_hold')
        and to_regprocedure('public.billing_dunning(text)') is not null
        and exists (select 1 from pg_trigger where tgname = 'billing_hold_guard' and not tgisinternal)
       then '실행됨' else '아직 안 됨' end as "결과"
union all
select '2. staff-site.sql (매니저 고객사 수정·기사 쓰기 잠금)',
  case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'articles' and policyname = 'articles_select_staff')
        and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'articles' and policyname = 'articles_insert'
                    and with_check like '%source_article_id%')
       then '실행됨' else '아직 안 됨' end
union all
select '3. account-security.sql (2단계 인증·출입 정지)',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'suspended_at')
        and to_regprocedure('public.my_mfa_required()') is not null
        and to_regprocedure('public.admin_suspend_user(uuid,boolean)') is not null
       then '실행됨' else '아직 안 됨' end
union all
select '4. group-solo.sql (개별 매체)',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publishers' and column_name = 'solo')
       then '실행됨' else '아직 안 됨' end
union all
select '5. outlet-delete.sql (빈 매체 지우기)',
  case when to_regprocedure('public.admin_delete_outlet(uuid)') is not null then '실행됨' else '아직 안 됨' end
union all
select '6. login-security.sql (로그인 기록·모든 기기 로그아웃)',
  case when to_regclass('public.login_events') is not null
        and to_regprocedure('public.member_last_seen()') is not null
        and coalesce(pg_get_functiondef(to_regprocedure('public.session_ok()')), '') like '%auth.sessions%'
       then '실행됨' else '아직 안 됨' end
union all
select '7. data-migration.sql (자료 옮기기·옛 기사 주소)',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'legacy_id')
        and to_regprocedure('public.legacy_article(uuid,text)') is not null
       then '실행됨' else '아직 안 됨' end
union all
select '8. ad-contracts.sql (광고 계약·견적서·메일 보낸 기록)',
  case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ad_documents' and column_name = 'sent_at')
       then '실행됨' else '아직 안 됨' end
union all
select '9. feedback.sql (개선 요청: 본인 글만 보기)',
  case when to_regprocedure('public.can_see_feedback(uuid)') is not null
        and coalesce(pg_get_functiondef(to_regprocedure('public.can_see_feedback(uuid)')), '') not like '%can_view_outlet%'
       then '실행됨' else '아직 안 됨' end
union all
select '10. view-count.sql (조회수가 수정 시각을 안 바꾸게)',
  case when coalesce(pg_get_functiondef(to_regprocedure('public.set_updated_at()')), '') like '%view_only%'
       then '실행됨' else '아직 안 됨' end
union all
select '11. scale.sql (매체 100곳 대비 색인)',
  case when to_regclass('public.articles_outlet_published') is not null and to_regclass('public.articles_outlet_updated') is not null
       then '실행됨' else '아직 안 됨' end
union all
select '12. support-ai.sql (업무요청 AI 첫 답변·저장 오류·지우기·운영팀 안내)',
  case when to_regprocedure('public.support_ai_reply(text,uuid,text,text,text,text,boolean)') is not null
        and to_regprocedure('public.staff_message_to(uuid,text,text)') is not null
        and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'tickets_delete')
        and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'support_tickets' and policyname = 'tickets_select' and qual like '%can_see_ticket%')
       then '실행됨' else '아직 안 됨' end
) x order by split_part(x."파일", '.', 1)::int;
