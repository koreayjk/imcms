-- 통합검색: 기사 제목뿐 아니라 부제·본문까지 찾는다 (여러 번 실행해도 안전하다)
--   · strip_html: 본문의 HTML 태그를 지워 글자만 남긴다 (검색어가 태그 이름·주소에 걸리지 않게)
--   · 검색용 색인(pg_trgm): 제목+부제+본문 글자에 대한 부분 일치(ilike '%낱말%')를 빠르게 한다
--   · search_article_ids: 그 매체의 발행된 기사 중 검색어가 들어 있는 기사 번호를 돌려준다 (제목에 있는 기사가 먼저, 그다음 최신순)

create extension if not exists pg_trgm;

create or replace function public.strip_html(t text) returns text
language sql immutable parallel safe
as $$ select regexp_replace(coalesce(t, ''), '<[^>]*>', ' ', 'g') $$;

create index if not exists articles_search_trgm on articles
  using gin ((title || ' ' || coalesce(excerpt, '') || ' ' || public.strip_html(body)) gin_trgm_ops);

create or replace function public.search_article_ids(p_outlet uuid, p_q text, p_limit int default 60)
returns table (id uuid, in_title boolean)
language sql stable security definer set search_path = public, extensions
as $$
  with q as (select '%' || replace(replace(replace(trim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat)
  select a.id, (a.title ilike q.pat) as in_title
  from articles a, q
  where a.outlet_id = p_outlet and a.status = 'published' and a.published_at <= now()
    and length(trim(p_q)) > 0
    and (a.title || ' ' || coalesce(a.excerpt, '') || ' ' || public.strip_html(a.body)) ilike q.pat
  order by (a.title ilike q.pat) desc, a.published_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

revoke all on function public.search_article_ids(uuid, text, int) from public;
grant execute on function public.search_article_ids(uuid, text, int) to anon, authenticated;
