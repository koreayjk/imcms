-- 기사 링크 공유: 아직 승인·발행되지 않은 기사도 "미리보기 링크"를 받은 사람은 볼 수 있게 한다
-- (Supabase SQL 에디터에서 실행, payments.sql 다음 — 서버 비밀 열쇠 payment_secret_ok 를 쓴다)
--   링크에는 서버만 만들 수 있는 서명이 붙고, 서버가 이 함수로 기사 한 건만 읽는다. 로그인·검색엔진 노출 없음

create or replace function public.article_share_view(secret text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not coalesce(public.payment_secret_ok(secret), false) then raise exception 'forbidden'; end if;
  select to_jsonb(a)
         || jsonb_build_object(
              'author_full_name', p.full_name,
              'category', case when c.id is null then null else jsonb_build_object('name', c.name, 'slug', c.slug) end)
    into v
  from articles a
  left join profiles p on p.id = a.author_id
  left join categories c on c.id = a.category_id
  where a.id = p_id;
  return v;
end $$;

revoke all on function public.article_share_view(text, uuid) from public;
grant execute on function public.article_share_view(text, uuid) to anon, authenticated;
