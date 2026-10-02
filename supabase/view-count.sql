-- 기사 조회수 집계 (Supabase SQL 에디터에서 실행)
--   독자가 기사 페이지를 열면 조회수 +1. 같은 브라우저는 12시간에 한 번만, 검색 로봇은 세지 않는다 (화면 쪽에서 거른다)
--   공개된 기사(발행 + 공개 시각 지남)만 올라간다

create or replace function public.increment_article_view(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update articles set view_count = view_count + 1
  where id = p_id and status = 'published' and (published_at is null or published_at <= now());
$$;
revoke all on function public.increment_article_view(uuid) from public;
grant execute on function public.increment_article_view(uuid) to anon, authenticated;
