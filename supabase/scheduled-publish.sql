-- 예약 발행 (Supabase SQL 에디터에서 실행)
--   발행 일시를 앞으로의 시각으로 정한 기사는 그 시각이 될 때까지 홈페이지(로그인 안 한 독자)에 보이지 않는다
--   별도 예약 작업 없이, 독자가 열어 볼 때 공개 시각이 지났는지로 판단한다 (화면에서도 같은 조건으로 거른다)

drop policy if exists "public_articles_select" on articles;
create policy "public_articles_select" on articles for select to anon
  using (status = 'published' and (published_at is null or published_at <= now()));
