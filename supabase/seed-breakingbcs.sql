-- Breaking BCS (영문 · 미국 텍사스 Bryan–College Station 지역 인터넷신문) 만들기
--   (Supabase SQL 에디터에서 실행, outlet-sites.sql 다음. 여러 번 실행해도 된다)
--   지역 뉴스·비즈니스·스포츠(Texas A&M 풋볼·농구·야구 중심)·라이프스타일 전문지.
--   홈페이지 언어 영어(lang = en), 남색 + 에이지 마룬(Texas A&M 느낌의 진한 적갈색) 포인트, 세리프 글꼴.
--   총관리자 그룹에 만든다 (고객 그룹으로 옮길 때는 매체 관리에서 그룹을 바꾼다)
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   로고는 아직 없어 매체 이름 글자로 보여준다. 도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다
--
--   1차 메뉴(6): Latest Headlines · Local News · Business · Sports · Lifestyle · Opinion
--   2차 메뉴: Local News(Bryan · College Station · Texas A&M) · Sports(Aggie Football · Basketball · Baseball)
--             · Lifestyle(Health & Sleep · Fashion · Food & Dining)  — 필요 없으면 섹션 화면에서 지운다
--   첫 화면 'Spotlight' 묶음: Business · Sports · Lifestyle

alter table categories add column if not exists parent_slug text;

do $$
declare
  grp uuid;
  oid uuid;
begin
  select id into grp from publishers where name = '총관리자 그룹' order by created_at limit 1;
  if grp is null then
    insert into publishers (name) values ('총관리자 그룹') returning id into grp;
  end if;

  select id into oid from outlets where name = 'Breaking BCS' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('Breaking BCS', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'lang', 'en',
    'nameEn', 'BRYAN · COLLEGE STATION · BRAZOS VALLEY',
    'slogan', 'Local news, business, sports and lifestyle for Bryan–College Station',
    'sloganEn', 'BRYAN–COLLEGE STATION, TEXAS',
    'description', 'Breaking BCS covers local news, business, Texas A&M sports and everyday life in Bryan, College Station and the Brazos Valley.',
    'specialtyTitle', 'Spotlight',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#1B2A41', 'accent', '#7A1F2B'),
    'indexable', false,
    'homeLayout', 'standard',
    'pressFields', jsonb_build_array(),
    'pressForeign', false,
    'pressForeignTopics', jsonb_build_array(),
    'pressKeywords', 'Bryan, College Station, Brazos County, Brazos Valley, Texas A&M, Aggies, Kyle Field, Reed Arena, Blue Bell Park, SEC football, Aggie basketball, Aggie baseball, city council, school district, BCS, Easterwood, Research Valley, small business, restaurant, real estate, health, wellness',
    'legal', jsonb_build_object(
      'company', 'Breaking BCS', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', 'Bryan–College Station, Texas', 'phone', '', 'email', 'contact@imnewsroom.com'
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'nameEn' is null);

  -- 1차 메뉴 (sort_order 1~6)
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('Latest Headlines', 'latest', 1, false, 'The newest stories from across the Brazos Valley'),
    ('Local News', 'local-news', 2, false, 'Bryan, College Station, Brazos County and Texas A&M'),
    ('Business', 'business', 3, true, 'Businesses, jobs, development and the local economy'),
    ('Sports', 'sports', 4, true, 'Texas A&M football, basketball and baseball, plus local teams'),
    ('Lifestyle', 'lifestyle', 5, true, 'Health, sleep, fashion, local food and everyday living'),
    ('Opinion', 'opinion', 6, false, 'Editorials, columns and letters')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('Bryan', 'bryan', 201, 'local-news'), ('College Station', 'college-station', 202, 'local-news'), ('Texas A&M', 'texas-am', 203, 'local-news'),
    ('Aggie Football', 'aggie-football', 401, 'sports'), ('Basketball', 'basketball', 402, 'sports'), ('Baseball', 'baseball', 403, 'sports'),
    ('Health & Sleep', 'health-sleep', 501, 'lifestyle'), ('Fashion', 'fashion', 502, 'lifestyle'), ('Food & Dining', 'food-dining', 503, 'lifestyle')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice 'Breaking BCS 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 확인: 매체 1개, 섹션 15개(1차 6 + 2차 9)가 나오면 끝
select o.name as 매체, o.site->>'lang' as 언어,
  (select count(*) from categories c where c.outlet_id = o.id and c.parent_slug is null) as "1차 섹션",
  (select count(*) from categories c where c.outlet_id = o.id and c.parent_slug is not null) as "2차 섹션"
from outlets o where o.name = 'Breaking BCS';
