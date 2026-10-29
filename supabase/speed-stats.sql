-- 통계·댓글 화면이 느릴 때 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다. article-stats.sql·comments.sql 다음)
--   원인: 통계·댓글 표의 권한 규칙이 "행마다" 권한 함수를 다시 부르고 있었다 (can_manage_outlet·is_staff·session_ok).
--         기사·댓글·하루 조회 기록이 수천 줄이면 그만큼 함수를 불러서 몇 초씩 걸린다. (speed-rls.sql 과 같은 문제)
--   고침: 행과 상관없는 값은 (select …)로 감싸 조회당 한 번만 계산하고, "내가 관리하는 매체 목록"에 속하는지만 본다.
--         누가 무엇을 볼 수 있는지는 그대로다.

-- 하루 조회·공유 기록
drop policy if exists "article_stats_read" on article_stats_daily;
create policy "article_stats_read" on article_stats_daily for select to authenticated
  using (outlet_id in (select public.manageable_outlets()) or coalesce((select public.is_staff()), false));
do $$ begin
  if to_regprocedure('public.session_ok()') is not null then
    drop policy if exists "zz_account_ok" on public.article_stats_daily;
    create policy "zz_account_ok" on public.article_stats_daily as restrictive for all to authenticated
      using ((select public.session_ok())) with check ((select public.session_ok()));
  end if;
end $$;

-- 댓글·독자·차단 목록
drop policy if exists "comments_manage" on comments;
create policy "comments_manage" on comments for all to authenticated
  using (outlet_id in (select public.manageable_outlets()) or coalesce((select public.is_staff()), false))
  with check (outlet_id in (select public.manageable_outlets()) or coalesce((select public.is_staff()), false));

drop policy if exists "readers_manage" on readers;
create policy "readers_manage" on readers for select to authenticated
  using (coalesce((select public.is_staff()), false)
         or exists (select 1 from comments c where c.reader_id = readers.id and c.outlet_id in (select public.manageable_outlets())));
drop policy if exists "readers_ban" on readers;
create policy "readers_ban" on readers for update to authenticated
  using (coalesce((select public.is_staff()), false)
         or exists (select 1 from comments c where c.reader_id = readers.id and c.outlet_id in (select public.manageable_outlets())))
  with check (true);

drop policy if exists "blocked_ips_manage" on comment_blocked_ips;
create policy "blocked_ips_manage" on comment_blocked_ips for all to authenticated
  using (outlet_id in (select public.manageable_outlets()) or coalesce((select public.is_staff()), false))
  with check (outlet_id in (select public.manageable_outlets()) or coalesce((select public.is_staff()), false));

-- 확인: 이 표들의 규칙 안에 행마다 부르는 함수 호출이 남았는지 (0건이면 정상)
select count(*) as 행마다_함수_호출_규칙 from pg_policies
where schemaname = 'public' and tablename in ('article_stats_daily', 'comments', 'readers', 'comment_blocked_ips')
  and (coalesce(qual, '') ~ '(can_manage_outlet|session_ok)\(' and coalesce(qual, '') !~ 'SELECT (public\.)?(session_ok|is_staff)');
