-- Breaking BCS: 편집인(John Lee)·AI 활용 표시(영문)·안 쓰는 기본 섹션 정리 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   seed-breakingbcs.sql 다음에 실행한다
--   · 법정 표기의 편집인이 비어 있으면 John Lee
--   · AI 활용 표시: 아직 정하지 않았으면 켜고 영문 문구를 넣는다 (AI 초안 기사 본문 끝에 붙는 문구)
--   · 화면에서 매체를 만들 때 자동으로 생긴 한국어 기본 섹션(정치·경제·사회·문화)은 기사가 없을 때만 지운다
--   · 다음 순서: supabase/seed-articles/breakingbcs-2026-10.sql (기사 20건)
do $$
declare oid uuid;
begin
  select id into oid from outlets where name = 'Breaking BCS' order by created_at limit 1;
  if oid is null then raise exception 'Breaking BCS 매체를 찾지 못했습니다. seed-breakingbcs.sql 을 먼저 실행해 주세요.'; end if;

  update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{legal}',
    coalesce(site->'legal', '{}'::jsonb) || jsonb_build_object('editor', 'John Lee'))
  where id = oid and coalesce(site->'legal'->>'editor', '') = '';

  update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{aiNotice}',
    jsonb_build_object('on', true, 'text', 'This article was written with the help of AI, based on public and official sources.'))
  where id = oid and site->'aiNotice' is null;

  delete from categories c
  where c.outlet_id = oid and c.slug in ('politics', 'economy', 'society', 'culture')
    and not exists (select 1 from articles a where a.category_id = c.id);
end $$;

-- 확인
select o.name as "매체", o.site->>'lang' as "언어", o.site->>'timeZone' as "시간대", o.site->>'comingSoon' as "오픈 준비 중",
  o.site->'legal'->>'editor' as "편집인", o.site->'aiNotice'->>'text' as "AI 표시",
  (select string_agg(c.name, ' · ' order by c.sort_order) from categories c where c.outlet_id = o.id and c.parent_slug is null) as "1차 메뉴"
from outlets o where o.name = 'Breaking BCS';
