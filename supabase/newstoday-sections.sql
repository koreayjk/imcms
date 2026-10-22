-- 투데이오늘 섹션(메뉴) 구성 — 고객이 보내 준 화면 기준 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   1차 메뉴: 4차산업 · 로컬 · 사회 · 오피니언 · 기획·특집 · 포토뉴스
--   2차 메뉴: 각 1차 메뉴 아래 (화면의 "전체"는 1차 메뉴를 누르면 나오는 전체 목록이라 따로 만들지 않는다)
--   * 고객 화면에서 위쪽(4차산업 앞)과 "사회" 아래쪽은 잘려 있었다. 더 있으면 같은 방식으로 아래에 한 줄씩 더한다
--   * 개설할 때 자동으로 생긴 기본 섹션(정치·경제·문화)은 건드리지 않는다. 필요 없으면 맨 아래 주석의 삭제문을 쓴다
do $$
declare oid uuid;
begin
  select id into oid from outlets where name = '투데이오늘' limit 1;
  if oid is null then
    select id into oid from outlets where name ilike '%투데이오늘%' order by created_at limit 1;
  end if;
  if oid is null then raise exception '투데이오늘 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.'; end if;

  alter table categories add column if not exists parent_slug text;

  -- 1차 메뉴 (이미 있는 slug 는 건너뛰고, 사회는 순서만 맞춘다)
  insert into categories (outlet_id, name, slug, sort_order)
  select oid, v.name, v.slug, v.ord
  from (values
    ('4차산업', 'industry4', 11),
    ('로컬', 'local', 12),
    ('사회', 'society', 13),
    ('오피니언', 'opinion', 14),
    ('기획·특집', 'feature', 15),
    ('포토뉴스', 'photo', 16)
  ) as v(name, slug, ord)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = v.slug);

  update categories set sort_order = 13 where outlet_id = oid and slug = 'society';

  -- 2차 메뉴 (parent_slug = 1차 메뉴의 slug)
  insert into categories (outlet_id, name, slug, sort_order, parent_slug)
  select oid, v.name, v.slug, v.ord, v.parent
  from (values
    ('4차산업 종합', 'industry4-general', 1, 'industry4'),
    ('AI', 'ai', 2, 'industry4'),
    ('빅데이터', 'bigdata', 3, 'industry4'),

    ('서울', 'seoul', 1, 'local'),
    ('경기', 'gyeonggi', 2, 'local'),
    ('인천', 'incheon', 3, 'local'),
    ('강원', 'gangwon', 4, 'local'),
    ('충청', 'chungcheong', 5, 'local'),
    ('영남', 'yeongnam', 6, 'local'),
    ('호남', 'honam', 7, 'local'),
    ('제주', 'jeju', 8, 'local'),

    ('사회종합', 'society-general', 1, 'society'),
    ('국제이슈', 'world-issue', 2, 'society'),

    ('사설', 'editorial', 1, 'opinion'),
    ('칼럼', 'column', 2, 'opinion'),
    ('기자수첩', 'reporters-note', 3, 'opinion'),
    ('기고', 'contribution', 4, 'opinion'),

    ('기획·특집', 'feature-special', 1, 'feature'),
    ('인터뷰', 'interview', 2, 'feature')
  ) as v(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = v.slug);
end $$;

-- 확인: 메뉴 순서대로
select coalesce(c.parent_slug, '') as 상위, c.sort_order as 순서, c.name as 이름, c.slug
  from categories c join outlets o on o.id = c.outlet_id
 where o.name ilike '%투데이오늘%'
 order by coalesce((select p.sort_order from categories p where p.outlet_id = c.outlet_id and p.slug = c.parent_slug), c.sort_order), c.parent_slug nulls first, c.sort_order;

-- (선택) 고객 목록에 없는 기본 섹션 지우기 — 기사가 아직 없을 때만. 필요하면 앞의 -- 를 지우고 실행
-- delete from categories where outlet_id = (select id from outlets where name ilike '%투데이오늘%' limit 1) and slug in ('politics', 'economy', 'culture');
