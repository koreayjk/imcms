-- 새 기사 저장이 "infinite recursion detected in policy for relation articles" 로 막힐 때 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   원인: 기사 "새로 만들기" 규칙(articles_insert)이 함께 송고 사본을 허용하려고 규칙 안에서 기사 표를 직접 다시 읽는다.
--         DB는 이것을 끝없이 도는 규칙으로 보고 새 기사 저장을 막는다.
--   고침: 그 부분만 "정의자 권한 함수"(can_copy_article)로 바꿔 읽는다. 누가 무엇을 할 수 있는지는 그대로다.
--         (다른 기사 규칙·로그인 보호 규칙은 건드리지 않는다)

create or replace function public.can_copy_article(src uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from articles s where s.id = src and public.can_manage_outlet(s.outlet_id))
$$;
grant execute on function public.can_copy_article(uuid) to authenticated;

drop policy if exists "articles_insert" on articles;
create policy "articles_insert" on articles for insert to authenticated
  with check (
    public.can_manage_outlet(outlet_id)
    or ((author_id = (select auth.uid())) and (outlet_id is null or outlet_id = (select public.my_outlet())))
    or (source_article_id is not null
        and (select public.my_publisher()) is not null
        and public.outlet_publisher(outlet_id) = (select public.my_publisher())
        and public.can_copy_article(source_article_id))
  );

-- 확인: 기사 표의 규칙 중 articles 를 직접 다시 읽는 것이 없어야 한다 (0건이면 정상)
select count(*) as 직접_다시_읽는_규칙 from pg_policies
where schemaname = 'public' and tablename = 'articles'
  and (coalesce(qual, '') ilike '%from articles%' or coalesce(with_check, '') ilike '%from articles%');
