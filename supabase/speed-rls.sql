-- 편집국 속도 개선: 권한 검사를 "한 번만" 하게 바꾼다 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   원인: 기사·보도자료 등을 읽을 때 DB가 "이 회원이 볼 수 있는 행인가"를 행마다 함수로 다시 계산한다.
--         기사 800건이면 800번 계산해서, 건수 세는 조회 하나가 1~4초 걸렸다.
--   고침: ① 모든 권한 규칙 속 is_approved()·is_super()·is_staff()·auth.uid() 등 "행과 상관없는 값"을 (select …)로 감싸
--           조회당 한 번만 계산하게 한다. 규칙의 뜻은 그대로다 (누가 무엇을 볼 수 있는지는 바뀌지 않는다)
--         ② 기사 읽기 규칙: "내가 관리하는 매체 목록"을 한 번 만들어 두고 거기에 속하는지만 본다
--         ③ 기사 상태별 건수(전체·작성중·승인신청…)를 5번이 아니라 1번에 세는 함수
--   되돌리기: 이 파일을 실행하기 전 규칙은 supabase/groups.sql·signup.sql 등에 그대로 있다. 문제가 있으면 알려 주세요

-- ② 내가 관리하는 매체 목록 (총관리자: 전부 / 발행인: 우리 그룹 매체 / 편집장: 내 매체) — can_manage_outlet 과 같은 뜻
create or replace function public.manageable_outlets() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from outlets where public.is_super()
  union
  select o.id from outlets o join profiles p on p.publisher_id = o.publisher_id
    where p.id = auth.uid() and p.role = 'admin' and p.publisher_id is not null
  union
  select p.outlet_id from profiles p where p.id = auth.uid() and p.role = 'editor' and p.outlet_id is not null
$$;
grant execute on function public.manageable_outlets() to authenticated;

drop policy if exists "articles_select" on articles;
create policy "articles_select" on articles for select to authenticated
  using (author_id = (select auth.uid()) or outlet_id in (select public.manageable_outlets()));

-- ③ 기사 상태별 건수 (기사목록 탭 숫자). mine = true 이면 내 기사만. 권한은 읽는 사람 기준(규칙 그대로 적용)
create or replace function public.article_status_counts(o uuid, mine boolean default false)
returns table (status text, n bigint)
language sql stable security invoker set search_path = public as $$
  select a.status::text, count(*) from articles a
  where (o is null or a.outlet_id = o) and (not mine or a.author_id = auth.uid())
  group by a.status
$$;
grant execute on function public.article_status_counts(uuid, boolean) to authenticated;

-- ① 모든 권한 규칙에서 행과 상관없는 값을 한 번만 계산하게 감싼다
do $$
declare
  r record;
  pat text := '(?<!SELECT )(?<!select )(?<![\w.])((public\.)?(is_approved|is_super|is_staff|is_group_admin|my_publisher|my_outlet)\(\)|auth\.uid\(\))';
  q text; w text; sql text; n int := 0;
begin
  for r in select schemaname, tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    q := case when r.qual is null then null else regexp_replace(r.qual, pat, '(select \1)', 'g') end;
    w := case when r.with_check is null then null else regexp_replace(r.with_check, pat, '(select \1)', 'g') end;
    if q is not distinct from r.qual and w is not distinct from r.with_check then continue; end if;
    sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename)
      || case when q is not null then format(' using (%s)', q) else '' end
      || case when w is not null then format(' with check (%s)', w) else '' end;
    execute sql;
    n := n + 1;
  end loop;
  raise notice '권한 규칙 %개를 고쳤습니다', n;
end $$;

analyze articles;
analyze press_releases;
analyze profiles;

-- 확인(선택): 실행 뒤 한참 쓴 다음 느린 조회를 다시 본다. 먼저 이 줄로 통계를 지우고 시작하면 정확하다
--   select pg_stat_statements_reset();
