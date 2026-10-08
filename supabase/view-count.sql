-- 기사 조회수 집계 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   독자가 기사 페이지를 열면 조회수 +1. 같은 브라우저는 12시간에 한 번만, 검색 로봇은 세지 않는다 (화면 쪽에서 거른다)
--   공개된 기사(발행 + 공개 시각 지남)만 올라간다
--   조회수만 올릴 때는 '최종 수정 시각'(updated_at)을 건드리지 않는다
--     (전에는 읽힐 때마다 바뀌어 편집국 기사목록 맨 위로 올라오고, 사이트맵의 수정 시각도 계속 바뀌었다)

create or replace function public.increment_article_view(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.view_only', 'on', true);
  update articles set view_count = view_count + 1
  where id = p_id and status = 'published' and (published_at is null or published_at <= now());
  perform set_config('app.view_only', 'off', true);
end $$;
revoke all on function public.increment_article_view(uuid) from public;
grant execute on function public.increment_article_view(uuid) to anon, authenticated;

-- 수정 시각 트리거: 조회수만 올리는 중이면 그대로 둔다
create or replace function set_updated_at()
returns trigger as $$
begin
  if coalesce(current_setting('app.view_only', true), '') = 'on' then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$ language plpgsql;
