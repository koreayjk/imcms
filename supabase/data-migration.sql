-- 자료 옮기기 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   1) 가져오기: 다른 프로그램(ND소프트·미디어온 등)에서 옮겨 온 기사에 옛 기사 번호를 남긴다
--      → 옛 기사 주소(/news/articleView.html?idxno=123, /news/article.html?no=123 …)로 들어와도 새 기사로 넘어간다
--         (검색엔진·포털·SNS에 퍼진 옛 링크가 끊기지 않는다)
--   2) 내보내기: 따로 표는 없다 (발행인·총관리자가 기사·사진을 내려받는다)

alter table articles add column if not exists legacy_id text;
create unique index if not exists articles_legacy on articles (outlet_id, legacy_id) where legacy_id is not null;

-- 홈페이지 방문자: 옛 기사 번호 → 새 기사 (발행된 기사만)
create or replace function public.legacy_article(o uuid, legacy text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from articles
  where outlet_id = o and legacy_id = left(trim(legacy), 64) and status = 'published' and published_at <= now()
  limit 1;
$$;
grant execute on function public.legacy_article(uuid, text) to anon, authenticated;

-- 확인: 매체별 옮겨 온 기사 수
select o.name as "매체", count(a.id) as "옮겨 온 기사"
from outlets o left join articles a on a.outlet_id = o.id and a.legacy_id is not null
group by o.name order by 2 desc;
