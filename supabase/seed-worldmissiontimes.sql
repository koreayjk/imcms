-- 월드미션타임즈 (세계선교 전문 인터넷신문, 치앙마이에서 시작) 만들기 (Supabase SQL 에디터에서 실행, outlet-sites.sql 다음. 여러 번 실행해도 된다)
--   세계선교 동향·선교 현장·미전도 종족·선교사 이야기를 전하는 한국어 매체. 첫 거점은 태국 치앙마이
--   대표님 그룹(총관리자 그룹)에 매체를 만들고, 홈페이지 설정(짙은 청록·금색, 슬로건, 해외 선교 언론, 홈 오른쪽 '숫자로 보는 세계선교')과 1차·2차 메뉴를 넣는다
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   로고는 아직 없어 매체 이름 글자로 보여준다. 도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다
--
--   숫자 판(공개 통계, 출처 표기). 새 통계가 나오면 편집국 → 매체 → 홈페이지 설정 → '숫자 판'에서 고친다
--     · 한국 장기 선교사 21,621명 (171개국) — 한국세계선교협의회(KWMA)·한국선교연구원(KRIM), 2024년 말 기준(2025년 3월 발표)
--     · 2024년 신규 파송 634명 — 같은 조사
--     · 세계 타문화 선교사 약 45만 5천 명 — 고든콘웰 세계기독교연구센터(CSGC) 「Status of Global Christianity 2026」
--     · 미전도 종족 7,163개 (전체 16,419개 종족의 43.6%, 나라별 집계) — 조슈아 프로젝트
--     · 태국 기독교인 1.8% (복음주의 0.7%), 110개 종족 중 73개 미전도 — 조슈아 프로젝트
--
--   1차 메뉴(8): 선교동향 · 치앙마이 · 아시아 · 세계선교 · 미전도종족 · 선교사 이야기 · 교회와 선교 · 오피니언
--   첫 화면 '치앙마이·현장' 전문뉴스: 치앙마이 · 미전도종족 · 선교사 이야기

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

  select id into oid from outlets where name in ('월드미션타임즈', '치앙마이미션타임즈') limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('월드미션타임즈', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'nameEn', 'WORLD MISSION TIMES',
    'slogan', '땅끝까지, 열방의 소식을 전합니다',
    'sloganEn', 'FROM CHIANG MAI TO THE NATIONS',
    'description', '세계선교 동향과 선교 현장, 미전도 종족과 선교사 이야기를 전하는 세계선교 전문 미디어. 태국 치앙마이에서 시작합니다.',
    'specialtyTitle', '치앙마이·현장',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#0E4D5C', 'accent', '#D99A22'),
    'indexable', false,
    'homeLayout', 'standard',
    'pressFields', jsonb_build_array(),
    'pressForeign', true,
    'pressForeignTopics', jsonb_build_array('mission'),
    'pressKeywords', '선교, 선교사, 선교회, 선교단체, 파송, 단기선교, 미전도, 종족, 성경번역, 교회개척, 디아스포라, 이주민, 다문화, 난민, 태국, 치앙마이, 동남아, 라오스, 미얀마, 캄보디아, 베트남, 몽골, 중앙아시아, 중동, 아프리카, KWMA, 세계선교, 선교대회, 선교 통계, NGO, 구호, 봉사, 해외봉사, 의료선교, mission, missionary, missions, unreached, Bible translation, church planting, persecution, Thailand, Chiang Mai',
    'statsBoard', jsonb_build_object(
      'title', '숫자로 보는 세계선교',
      'items', jsonb_build_array(
        jsonb_build_object('label', '한국 장기 선교사', 'value', '21,621명', 'note', '171개국', 'source', 'KWMA·KRIM, 2024년 말', 'url', 'https://missionews.co.kr/news/585391'),
        jsonb_build_object('label', '2024년 신규 파송', 'value', '634명', 'note', '아시아 65.2%', 'source', 'KWMA·KRIM, 2024년 말', 'url', 'https://missionews.co.kr/news/585391'),
        jsonb_build_object('label', '세계 타문화 선교사', 'value', '약 45만 5천 명', 'source', '고든콘웰 세계기독교연구센터, 2026', 'url', 'https://www.gordonconwell.edu/center-for-global-christianity/resources/status-of-global-christianity/'),
        jsonb_build_object('label', '미전도 종족', 'value', '7,163개', 'note', '전체 16,419개 중 43.6%', 'source', '조슈아 프로젝트', 'url', 'https://joshuaproject.net/'),
        jsonb_build_object('label', '태국 기독교인 비율', 'value', '1.8%', 'note', '복음주의 0.7%', 'source', '조슈아 프로젝트', 'url', 'https://joshuaproject.net/countries/th')
      ),
      'footnote', '기관마다 집계 기준이 다릅니다. 한국 선교사 수는 교단·선교단체가 보고한 장기 선교사 기준이며, 교회가 직접 파송한 선교사는 빠져 있을 수 있습니다.'
    ),
    'legal', jsonb_build_object(
      'company', '월드미션타임즈', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', ''
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'nameEn' is null);

  -- 1차 메뉴 (sort_order 1~8). 치앙마이·미전도종족·선교사 이야기는 첫 화면 '치앙마이·현장' 전문뉴스 묶음
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('선교동향', 'trends', 1, false, '한국선교 · 세계선교 통계·연구 · 선교대회·포럼'),
    ('치앙마이', 'chiangmai', 2, true, '치앙마이 선교 현장 · 태국 교회 · 산지 종족 · 선교사 생활'),
    ('아시아', 'asia', 3, false, '동남아시아 · 동북아시아 · 남아시아 · 중앙아시아'),
    ('세계선교', 'world', 4, false, '중동·북아프리카 · 아프리카 · 유럽·유라시아 · 아메리카·오세아니아'),
    ('미전도종족', 'unreached', 5, true, '종족 이야기 · 성경번역 · 중보기도'),
    ('선교사 이야기', 'missionaries', 6, true, '인터뷰 · 선교 현장 편지 · 멤버케어 · 은퇴 선교사'),
    ('교회와 선교', 'church', 7, false, '단기선교 · 이주민 선교 · 다음세대 선교 · 선교 동원'),
    ('오피니언', 'opinion', 8, false, '칼럼 · 선교 신학 · 인터뷰')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('한국선교', 'trends-korea', 101, 'trends'), ('통계·연구', 'trends-data', 102, 'trends'), ('선교대회·포럼', 'trends-events', 103, 'trends'),
    ('치앙마이 현장', 'cm-field', 201, 'chiangmai'), ('태국 교회', 'cm-thai-church', 202, 'chiangmai'), ('산지 종족', 'cm-hill-tribes', 203, 'chiangmai'),
    ('선교사 생활', 'cm-life', 204, 'chiangmai'),
    ('동남아시아', 'asia-southeast', 301, 'asia'), ('동북아시아', 'asia-northeast', 302, 'asia'), ('남아시아', 'asia-south', 303, 'asia'),
    ('중앙아시아', 'asia-central', 304, 'asia'),
    ('중동·북아프리카', 'world-mena', 401, 'world'), ('아프리카', 'world-africa', 402, 'world'), ('유럽·유라시아', 'world-europe', 403, 'world'),
    ('아메리카·오세아니아', 'world-americas', 404, 'world'),
    ('종족 이야기', 'up-peoples', 501, 'unreached'), ('성경번역', 'up-bible', 502, 'unreached'), ('중보기도', 'up-prayer', 503, 'unreached'),
    ('인터뷰', 'ms-interview', 601, 'missionaries'), ('현장 편지', 'ms-letters', 602, 'missionaries'), ('멤버케어', 'ms-care', 603, 'missionaries'),
    ('은퇴 선교사', 'ms-retired', 604, 'missionaries'),
    ('단기선교', 'ch-short-term', 701, 'church'), ('이주민 선교', 'ch-migrants', 702, 'church'), ('다음세대 선교', 'ch-nextgen', 703, 'church'),
    ('선교 동원', 'ch-mobilization', 704, 'church'),
    ('칼럼', 'op-column', 801, 'opinion'), ('선교 신학', 'op-theology', 802, 'opinion')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice '월드미션타임즈 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name in ('월드미션타임즈', '치앙마이미션타임즈');
