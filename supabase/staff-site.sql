-- IM 뉴스룸 매니저가 고객사 수정 요청을 직접 처리 (Supabase SQL 에디터에서 실행, staff.sql · groups.sql 다음. 여러 번 실행해도 된다)
--   매니저(운영팀)는 고객사 매체를 골라 섹션 고치기·지우기, 홈 편집판 배치를 할 수 있다
--   (홈페이지 설정·광고 배너는 이미 운영팀이 할 수 있다)
--   그대로 막아 두는 것: 고객사 기사 쓰기·고치기, 회원 권한, 청구서 발행
--   (홈 편집판에 기사를 놓으려면 발행된 기사 목록은 볼 수 있어야 하므로 '발행된 기사 읽기'만 연다)

drop policy if exists "categories_update" on categories;
create policy "categories_update" on categories for update to authenticated
  using (public.is_staff() or public.can_manage_outlet(outlet_id));
drop policy if exists "categories_delete" on categories;
create policy "categories_delete" on categories for delete to authenticated
  using (public.is_staff() or public.can_manage_outlet(outlet_id));
drop policy if exists "categories_insert" on categories;
create policy "categories_insert" on categories for insert to authenticated
  with check (public.is_staff() or public.can_manage_outlet(outlet_id));

do $$
begin
  if to_regclass('public.home_layouts') is not null then
    drop policy if exists "home_layouts_insert" on home_layouts;
    create policy "home_layouts_insert" on home_layouts for insert to authenticated
      with check (public.is_staff() or public.can_manage_outlet(outlet_id));
    drop policy if exists "home_layouts_update" on home_layouts;
    create policy "home_layouts_update" on home_layouts for update to authenticated
      using (public.is_staff() or public.can_manage_outlet(outlet_id));
  end if;
end $$;

-- 매니저는 발행된 기사만 읽을 수 있다 (홈 편집판 배치용. 발행 기사는 홈페이지에도 공개되어 있다)
drop policy if exists "articles_select_staff" on articles;
create policy "articles_select_staff" on articles for select to authenticated
  using (public.is_staff() and status = 'published');

-- 기사 쓰기는 내 매체·내가 관리하는 매체만 (예전 syndication.sql 규칙이 남아 있으면 아무 매체에나 쓸 수 있으므로 다시 잠근다)
--   함께 송고 사본: 내가 관리하는 매체의 원본을 같은 그룹 매체로 보내는 것은 그대로 된다
drop policy if exists "articles_insert" on articles;
create policy "articles_insert" on articles for insert to authenticated
  with check (
    public.can_manage_outlet(outlet_id)
    or (author_id = auth.uid() and (outlet_id is null or outlet_id = public.my_outlet()))
    or (source_article_id is not null
        and public.my_publisher() is not null and public.outlet_publisher(outlet_id) = public.my_publisher()
        and exists (select 1 from articles s where s.id = articles.source_article_id and public.can_manage_outlet(s.outlet_id)))
  );

-- 확인: 이번에 만든 규칙 (5~7줄이 나오면 끝)
--   (예전에는 매니저 담당 매체 표를 읽었는데, 그 표가 없는 DB에서는 오류가 나며 위 내용까지 모두 취소됐다)
select tablename as "표", policyname as "규칙"
from pg_policies
where schemaname = 'public'
  and policyname in ('categories_update', 'categories_delete', 'categories_insert', 'home_layouts_insert', 'home_layouts_update', 'articles_select_staff', 'articles_insert')
order by 1, 2;
