-- 투데이오늘 → 뉴스폭탄: 매체 이름은 이미 바꿨고, 기사·설정 안에 남은 옛 이름을 고친다
--   (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   바뀌는 것: 뉴스폭탄 기사의 제목·요약·본문·AI 메모 속 '투데이오늘', 매체 소개 문구, 법적 고지의 회사명
--   그대로 두는 것: 기자명(이호현)·기사 상태·발행 시각·주소(도메인)·메뉴·사진 경로(/sites/newstoday/…)
--   ※ 시작용 기사 SQL(seed-articles/newstoday-*.sql)은 옛 이름 기준이라 다시 실행하지 않는다
do $$
declare
  from_name text := '투데이오늘';
  to_name text := '뉴스폭탄';
  oid uuid;
  n int;
begin
  select id into oid from outlets where name = to_name order by created_at limit 1;
  if oid is null then raise exception '% 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.', to_name; end if;

  update outlets set site = jsonb_set(site, '{description}', to_jsonb(replace(site->>'description', from_name, to_name)))
  where id = oid and site->>'description' like '%' || from_name || '%';

  update outlets set site = jsonb_set(site, '{legal,company}', to_jsonb(to_name))
  where id = oid and site->'legal'->>'company' = from_name;

  update articles set
    title = replace(title, from_name, to_name),
    excerpt = replace(excerpt, from_name, to_name),
    body = replace(body, from_name, to_name),
    ai_notes = replace(ai_notes, from_name, to_name)
  where outlet_id = oid
    and (title like '%' || from_name || '%' or excerpt like '%' || from_name || '%'
      or body like '%' || from_name || '%' or ai_notes like '%' || from_name || '%');
  get diagnostics n = row_count;

  raise notice '% 기사 %건에서 "%"를 "%"(으)로 바꿨습니다', to_name, n, from_name, to_name;
end $$;

-- 확인: 아래 두 숫자가 0이면 끝. 설정(site) 안에 옛 이름이 남았으면 "설정에 남은 곳"에 보인다
select o.name as "매체", o.domain as "주소", o.site->>'nameEn' as "영문 이름",
  (select count(*) from articles a where a.outlet_id = o.id
     and (a.title || coalesce(a.excerpt, '') || coalesce(a.body, '') || coalesce(a.ai_notes, '')) like '%투데이오늘%') as "옛 이름 남은 기사",
  (select string_agg(e.key, ', ') from jsonb_each_text(coalesce(o.site, '{}'::jsonb)) e where e.value like '%투데이오늘%') as "설정에 남은 곳"
from outlets o where o.name = '뉴스폭탄';
