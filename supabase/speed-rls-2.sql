-- 속도 개선 2차: 모든 표에 걸려 있는 "정지·2단계 인증·로그아웃 확인" 규칙(zz_account_ok)을 조회당 한 번만 계산하게 한다
--   (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   원인: 이 규칙은 session_ok() 를 부르는데, 그 안에서 회원 표·인증 세션 표를 읽는다.
--         기사 800건을 읽으면 800번 실행된다 (표마다 한 줄씩 걸려 있어 모든 화면이 영향을 받는다)
--   고침: 읽기·수정·삭제 때 쓰는 조건(using)만 (select …)로 감싼다. 새 행을 넣을 때 쓰는 조건(with check)은
--         예전 파일(account-security.sql)에 적힌 이유로 그대로 둔다. 누가 무엇을 볼 수 있는지는 바뀌지 않는다
do $$
declare r record; n int := 0;
begin
  for r in select tablename, policyname from pg_policies
           where schemaname = 'public' and policyname = 'zz_account_ok' and qual = 'session_ok()'
  loop
    execute format('alter policy %I on public.%I using ((select public.session_ok()))', r.policyname, r.tablename);
    n := n + 1;
  end loop;
  raise notice 'zz_account_ok 규칙 %개를 고쳤습니다', n;
end $$;
