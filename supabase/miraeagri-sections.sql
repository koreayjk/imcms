-- 미래농업매거진 섹션(메뉴) 구성 — 고객이 보내 준 화면 기준 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   이달의 청농인 · 기획-특집 · 농정 · 기업현황 · 트렌드 리포트 · 우리네 농업 현장 · 오피니언
--   매체를 만들 때 자동으로 생긴 기본 섹션(정치·경제·사회·문화)은 건드리지 않는다. 기사가 없을 때 필요 없으면 맨 아래 삭제문을 쓴다
do $$
declare oid uuid;
begin
  select id into oid from outlets where name = '미래농업매거진' limit 1;
  if oid is null then raise exception '미래농업매거진 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.'; end if;

  insert into categories (outlet_id, name, slug, sort_order)
  select oid, v.name, v.slug, v.ord
  from (values
    ('이달의 청농인', 'young-farmer', 11),
    ('기획-특집', 'feature', 12),
    ('농정', 'agri-policy', 13),
    ('기업현황', 'companies', 14),
    ('트렌드 리포트', 'trend-report', 15),
    ('우리네 농업 현장', 'farm-field', 16),
    ('오피니언', 'opinion', 17)
  ) as v(name, slug, ord)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = v.slug);
end $$;

-- (선택) 기본 섹션 지우기 — 그 섹션에 기사가 없을 때만. 필요하면 앞의 -- 를 지우고 실행
-- delete from categories where outlet_id = (select id from outlets where name = '미래농업매거진' limit 1) and slug in ('politics', 'economy', 'society', 'culture');
