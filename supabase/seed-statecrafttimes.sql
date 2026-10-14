-- The Statecraft Times (영문 국제정치 인터넷신문) 만들기 (Supabase SQL 에디터에서 실행, outlet-sites.sql 다음. 여러 번 실행해도 된다)
--   미국 신문 느낌의 영문 매체: 홈페이지 언어 영어(lang = en — 메뉴·날짜·안내 문구·개인정보처리방침이 영어, 날짜는 미국 동부 시간),
--   짙은 남색·진홍색, 세리프 글꼴. 대표님 그룹(총관리자 그룹)에 만든다
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   로고는 아직 없어 매체 이름 글자로 보여준다. 도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다
--
--   1차 메뉴(8): World · Asia · U.S. Policy · Diplomacy · Security · Economy · Analysis · Opinion
--   첫 화면 'In Focus' 묶음: Security · Economy · Analysis

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

  select id into oid from outlets where name = 'The Statecraft Times' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('The Statecraft Times', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'lang', 'en',
    'nameEn', 'WORLD AFFAIRS · DIPLOMACY · SECURITY',
    'slogan', 'Clear reporting on the forces shaping the world',
    'sloganEn', 'INTERNATIONAL POLITICS',
    'description', 'The Statecraft Times covers international politics, diplomacy, security and the global economy for readers around the world.',
    'specialtyTitle', 'In Focus',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#14213D', 'accent', '#9B1C2E'),
    'indexable', false,
    'homeLayout', 'standard',
    'pressFields', jsonb_build_array(),
    'pressForeign', false,
    'pressForeignTopics', jsonb_build_array(),
    'pressKeywords', 'diplomacy, foreign policy, foreign minister, secretary of state, ambassador, embassy, summit, sanctions, tariff, trade deal, NATO, United Nations, Security Council, ceasefire, peace talks, election, parliament, president, prime minister, defense, military, missile, nuclear, intelligence, espionage, Ukraine, Russia, China, Taiwan, Korea, Japan, India, Pakistan, Iran, Israel, Gaza, Saudi, EU, G7, G20, ASEAN, APEC, IMF, World Bank',
    'legal', jsonb_build_object(
      'company', 'The Statecraft Times', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', 'contact@imnewsroom.com'
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'nameEn' is null);

  -- 1차 메뉴 (sort_order 1~8)
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('World', 'world', 1, false, 'Americas · Europe · Middle East · Africa'),
    ('Asia', 'asia', 2, false, 'China · Korea · Japan · South, Southeast and Central Asia'),
    ('U.S. Policy', 'us-policy', 3, false, 'The White House, State Department and Congress on the world stage'),
    ('Diplomacy', 'diplomacy', 4, false, 'Summits, alliances, the U.N. and global institutions'),
    ('Security', 'security', 5, true, 'War, defense, nuclear weapons and intelligence'),
    ('Economy', 'economy', 6, true, 'Trade, sanctions, energy and technology'),
    ('Analysis', 'analysis', 7, true, 'Context and explainers on the stories that matter'),
    ('Opinion', 'opinion', 8, false, 'Commentary and arguments')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('Americas', 'americas', 101, 'world'), ('Europe', 'europe', 102, 'world'), ('Middle East', 'middle-east', 103, 'world'), ('Africa', 'africa', 104, 'world'),
    ('China', 'china', 201, 'asia'), ('Korea', 'korea', 202, 'asia'), ('Japan', 'japan', 203, 'asia'),
    ('South Asia', 'south-asia', 204, 'asia'), ('Southeast Asia', 'southeast-asia', 205, 'asia'), ('Central Asia', 'central-asia', 206, 'asia'),
    ('U.N. & Global Institutions', 'multilateral', 401, 'diplomacy'),
    ('War in Ukraine', 'ukraine-war', 501, 'security'), ('Defense', 'defense', 502, 'security'), ('Nuclear', 'nuclear', 503, 'security'),
    ('Intelligence', 'intelligence', 504, 'security'),
    ('Trade', 'trade', 601, 'economy'), ('Sanctions', 'sanctions', 602, 'economy'), ('Technology & AI', 'technology', 603, 'economy')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice 'The Statecraft Times 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name = 'The Statecraft Times';
