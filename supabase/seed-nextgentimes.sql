-- 다음세대타임즈 (개혁주의 기독교 교육 인터넷신문) 만들기 (Supabase SQL 에디터에서 실행, outlet-sites.sql·seed-eduwide.sql 다음)
--   성경을 최종 권위로 삼는 개혁주의 신학(웨스트민스터 신앙고백·하이델베르크 요리문답)에 서서
--   교회교육·기독교학교·가정 신앙교육·교육정책을 다루는 매체. 대표님 그룹(총관리자 그룹)에 매체를 만들고
--   홈페이지 설정(짙은 녹색·금색, 슬로건, 보도자료 추천 키워드, 해외 개혁주의·기독교교육 언론)과 1차·2차 메뉴를 넣는다
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   로고는 아직 없어 매체 이름 글자로 보여준다. 도메인·등록번호는 정해지면 "매체 → 홈페이지 설정"에서 넣는다
--
--   1차 메뉴(9): 교회교육 · 기독교학교 · 가정·부모 · 교리·신학 · 성경적 세계관 · 교육정책 · 청소년·청년 · 해외 · 오피니언
--   전문뉴스(개혁주의 교육): 교리·신학 · 성경적 세계관 · 기독교학교

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

  select id into oid from outlets where name = '다음세대타임즈' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('다음세대타임즈', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'nameEn', 'NEXTGEN TIMES',
    'slogan', '말씀 위에 세우는 다음세대 교육',
    'sloganEn', 'REFORMED · CHRISTIAN · EDUCATION',
    'description', '개혁주의 신앙에 서서 교회교육·기독교학교·가정 신앙교육과 교육 현장을 전하는 기독교 교육 전문 미디어',
    'specialtyTitle', '개혁주의 교육',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#1E4636', 'accent', '#B38B4D'),
    'indexable', false,
    'homeLayout', 'standard',
    'pressFields', jsonb_build_array('education'),
    'pressForeign', true,
    'pressForeignTopics', jsonb_build_array('reformed'),
    'pressKeywords', '교회, 교회학교, 주일학교, 다음세대, 기독교, 기독, 크리스천, 개신교, 장로교, 개혁주의, 개혁신학, 신학, 신학교, 신학대, 목회, 목회자, 목사, 선교, 선교사, 성경, 교리, 요리문답, 신앙, 신앙교육, 기독교교육, 기독교학교, 기독교대안학교, 대안학교, 미션스쿨, 종교교육, 홈스쿨, 홈스쿨링, 가정예배, 학부모, 자녀교육, 청소년, 청년, 대학생, 수련회, 캠프, 교사, 교원, 학교, 교육부, 교육청, 교육감, 교육과정, 학생인권, 성교육, 포괄적 성교육, 차별금지, 생명, 저출산, 인성교육, 세계관, 기독교 세계관, reformed, christian, church, gospel, theology, seminary, catechism, classical, homeschool, discipleship',
    'legal', jsonb_build_object(
      'company', '다음세대타임즈', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', ''
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'nameEn' is null);

  -- 1차 메뉴 (sort_order 1~9). 교리·신학·성경적 세계관·기독교학교는 첫 화면 '개혁주의 교육' 전문뉴스 묶음
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('교회교육', 'church-edu', 1, false, '주일학교·교회학교 · 교사 · 교육부서 · 교재·공과'),
    ('기독교학교', 'christian-school', 2, true, '기독교대안학교 · 미션스쿨 · 홈스쿨링 · 고전 기독교교육'),
    ('가정·부모', 'family', 3, false, '가정예배 · 신앙 양육 · 자녀교육 · 결혼·출산'),
    ('교리·신학', 'doctrine', 4, true, '개혁신학 · 신앙고백·요리문답 · 교회사 · 신학교'),
    ('성경적 세계관', 'worldview', 5, true, '문화·미디어 · 과학과 신앙 · 생명·윤리 · AI·디지털'),
    ('교육정책', 'policy', 6, false, '교육부·교육청 · 교육과정·교과서 · 종교교육 자유 · 학생인권·성교육'),
    ('청소년·청년', 'youth', 7, false, '청소년 · 청년·대학생 · 진로·소명 · 수련회·캠프'),
    ('해외', 'global', 8, false, '해외 기독교교육 · 해외 교회 · 선교·MK교육'),
    ('오피니언', 'opinion', 9, false, '칼럼 · 설교 · 인터뷰 · 서평')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('주일학교·교회학교', 'church-sunday', 101, 'church-edu'), ('교사', 'church-teachers', 102, 'church-edu'),
    ('교육부서·목회', 'church-ministry', 103, 'church-edu'), ('교재·공과', 'church-curriculum', 104, 'church-edu'),
    ('기독교대안학교', 'school-alternative', 201, 'christian-school'), ('미션스쿨', 'school-mission', 202, 'christian-school'),
    ('홈스쿨링', 'school-home', 203, 'christian-school'), ('고전 기독교교육', 'school-classical', 204, 'christian-school'),
    ('가정예배', 'family-worship', 301, 'family'), ('신앙 양육', 'family-nurture', 302, 'family'),
    ('자녀교육', 'family-parenting', 303, 'family'), ('결혼·출산', 'family-marriage', 304, 'family'),
    ('개혁신학', 'doctrine-reformed', 401, 'doctrine'), ('신앙고백·요리문답', 'doctrine-confession', 402, 'doctrine'),
    ('교회사', 'doctrine-history', 403, 'doctrine'), ('신학교', 'doctrine-seminary', 404, 'doctrine'),
    ('문화·미디어', 'wv-culture', 501, 'worldview'), ('과학과 신앙', 'wv-science', 502, 'worldview'),
    ('생명·윤리', 'wv-ethics', 503, 'worldview'), ('AI·디지털', 'wv-digital', 504, 'worldview'),
    ('교육부·교육청', 'policy-gov', 601, 'policy'), ('교육과정·교과서', 'policy-curriculum', 602, 'policy'),
    ('종교교육 자유', 'policy-freedom', 603, 'policy'), ('학생인권·성교육', 'policy-rights', 604, 'policy'),
    ('청소년', 'youth-teens', 701, 'youth'), ('청년·대학생', 'youth-college', 702, 'youth'),
    ('진로·소명', 'youth-calling', 703, 'youth'), ('수련회·캠프', 'youth-camp', 704, 'youth'),
    ('해외 기독교교육', 'global-edu', 801, 'global'), ('해외 교회', 'global-church', 802, 'global'),
    ('선교·MK교육', 'global-mission', 803, 'global'),
    ('칼럼', 'op-column', 901, 'opinion'), ('설교', 'op-sermon', 902, 'opinion'),
    ('인터뷰', 'op-interview', 903, 'opinion'), ('서평', 'op-review', 904, 'opinion')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice '다음세대타임즈 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name = '다음세대타임즈';
