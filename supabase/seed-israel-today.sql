-- Israel Today (이스라엘 전문 기독교 미디어) 만들기 (Supabase SQL 에디터에서 1회 실행, outlet-sites.sql 다음)
--   대표님 그룹(총관리자 그룹)에 매체를 만들고, 홈페이지 설정(로고·색·슬로건·섹션 띠 배치)과 1차·2차 메뉴를 넣는다
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다. 그 전에는 미리보기 주소로 본다
--
--   1차 메뉴(8): 이스라엘 · 한국교계 · SHEMA · 성경과 이스라엘 · 선교 · 성지·문화 · 영상 · SHOP
--   홈 순서: 톱 기사(오늘의 이스라엘) → 이스라엘 현지 속보 → 한국교계 → SHEMA → 성경과 이스라엘 → 선교·크리스천 → 영상 → 성지·문화 → SHOP
--   (기사가 없는 띠는 홈에 나오지 않는다. SHEMA·SHOP 띠는 기사가 없어도 소개를 보여준다)

-- 0) 2차 메뉴: 섹션마다 상위 섹션 slug (모든 매체에서 쓸 수 있다. 비어 있으면 1차 메뉴)
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

  select id into oid from outlets where name = 'Israel Today' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('Israel Today', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'nameEn', 'ISRAEL TODAY',
    'slogan', '이스라엘을 바로 알고, 말씀을 다음 세대에',
    'sloganEn', 'ISRAEL · BIBLE · SHEMA',
    'description', '이스라엘 현지 소식과 성경·쉐마 교육을 전하는 기독교 전문 미디어',
    'specialtyTitle', 'SHEMA',
    'logoUrl', '/sites/israeltoday/logo-full.svg',
    'logoMode', 'full',
    'colors', jsonb_build_object('brand', '#0F3B82', 'accent', '#C9A55A'),
    'indexable', false,
    'homeLayout', 'bands',
    'pressForeign', true,
    'bands', jsonb_build_array(
      jsonb_build_object('slug', 'israel', 'style', 'brief', 'title', '이스라엘 현지 속보'),
      jsonb_build_object('slug', 'korea-church', 'style', 'news'),
      jsonb_build_object('slug', 'shema', 'style', 'feature', 'title', 'SHEMA', 'tagline', '말씀을 듣고, 배우고, 다음 세대에 전하다'),
      jsonb_build_object('slug', 'bible-israel', 'style', 'news'),
      jsonb_build_object('slug', 'mission', 'style', 'news', 'title', '선교·크리스천'),
      jsonb_build_object('slug', 'video', 'style', 'video'),
      jsonb_build_object('slug', 'holyland', 'style', 'grid'),
      jsonb_build_object('slug', 'shop', 'style', 'shop', 'title', 'ISRAEL SHOP', 'tagline', '이스라엘 현지상품 · 성경·도서 · 교육자료 · 기념품 · 성지상품')
    ),
    'pressKeywords', '이스라엘, 예루살렘, 유대, 유대인, 히브리, 성지, 성지순례, 성경, 고고학, 쉐마, 토라, 절기, 유월절, 초막절, 오순절, 메시아닉, 중동, 가자, 하마스, 헤즈볼라, 이란, 텔아비브, 네타냐후, 교회, 교계, 기독교, 선교, 목회, Israel, Israeli, Jerusalem, Jewish, Judaism, Torah, Bible, Biblical, Christian, Christians, Evangelical, Messianic, Archaeology, Temple, Sukkot, Passover, Hanukkah, Shabbat, Knesset, Netanyahu, IDF, Gaza, Hamas, Hezbollah, Iran',
    'legal', jsonb_build_object(
      'company', 'Israel Today', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', ''
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'logoUrl' is null);

  -- 1차 메뉴 (sort_order 1~8)
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('이스라엘', 'israel', 1, false, '이스라엘 현지뉴스 · 정치/외교 · 안보/중동 · 사회 · 경제/산업'),
    ('한국교계', 'korea-church', 2, false, '한국 교회와 교계 소식'),
    ('SHEMA', 'shema', 3, false, '말씀을 듣고, 배우고, 다음 세대에 전하다'),
    ('성경과 이스라엘', 'bible-israel', 4, false, '성경의 땅 · 성서고고학 · 절기 · 히브리어 · 유대문화'),
    ('선교', 'mission', 5, false, '이스라엘 선교 · 세계선교 · 메시아닉쥬 · 기독교와 이스라엘'),
    ('성지·문화', 'holyland', 6, false, '예루살렘 · 성지순례 · 역사 · 여행'),
    ('영상', 'video', 7, false, '현지영상 · 인터뷰 · 설교/강의 · Israel Today TV'),
    ('SHOP', 'shop', 8, false, '이스라엘 굿즈 · 도서 · 교육자료 · 기념품')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('현지뉴스', 'israel-local', 101, 'israel'), ('정치/외교', 'israel-politics', 102, 'israel'), ('안보/중동', 'israel-security', 103, 'israel'),
    ('사회', 'israel-society', 104, 'israel'), ('경제/산업', 'israel-economy', 105, 'israel'), ('오피니언', 'israel-opinion', 106, 'israel'),
    ('교계뉴스', 'church-news', 201, 'korea-church'), ('교회/목회', 'church-ministry', 202, 'korea-church'), ('선교', 'church-mission', 203, 'korea-church'),
    ('기관/단체', 'church-org', 204, 'korea-church'), ('다음세대', 'church-nextgen', 205, 'korea-church'),
    ('쉐마교육', 'shema-edu', 301, 'shema'), ('토라·성경', 'shema-torah', 302, 'shema'), ('유대인 자녀교육', 'shema-jewish-edu', 303, 'shema'),
    ('가정예배', 'shema-family', 304, 'shema'), ('부모교육', 'shema-parents', 305, 'shema'), ('다음세대', 'shema-nextgen', 306, 'shema'),
    ('영상강의', 'shema-video', 307, 'shema'), ('칼럼', 'shema-column', 308, 'shema'),
    ('성경의 땅', 'bible-land', 401, 'bible-israel'), ('성서고고학', 'bible-archaeology', 402, 'bible-israel'), ('절기', 'bible-feasts', 403, 'bible-israel'),
    ('히브리어', 'bible-hebrew', 404, 'bible-israel'), ('유대문화', 'bible-jewish-culture', 405, 'bible-israel'),
    ('이스라엘 선교', 'mission-israel', 501, 'mission'), ('세계선교', 'mission-world', 502, 'mission'), ('메시아닉쥬', 'mission-messianic', 503, 'mission'),
    ('기독교와 이스라엘', 'mission-christian-israel', 504, 'mission'), ('간증', 'mission-testimony', 505, 'mission'),
    ('예루살렘', 'holyland-jerusalem', 601, 'holyland'), ('성지순례', 'holyland-pilgrimage', 602, 'holyland'), ('역사', 'holyland-history', 603, 'holyland'),
    ('여행', 'holyland-travel', 604, 'holyland'), ('음식/생활', 'holyland-life', 605, 'holyland'), ('사진', 'holyland-photo', 606, 'holyland'),
    ('현지영상', 'video-local', 701, 'video'), ('인터뷰', 'video-interview', 702, 'video'), ('설교/강의', 'video-sermon', 703, 'video'),
    ('쇼츠', 'video-shorts', 704, 'video'), ('Israel Today TV', 'video-tv', 705, 'video'),
    ('이스라엘 굿즈', 'shop-goods', 801, 'shop'), ('도서', 'shop-books', 802, 'shop'), ('성경/교육', 'shop-edu', 803, 'shop'),
    ('기념품', 'shop-souvenir', 804, 'shop'), ('특별기획', 'shop-special', 805, 'shop')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice 'Israel Today 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name = 'Israel Today';
