-- 에듀와이드 (교육 전문 인터넷신문) 만들기 (Supabase SQL 에디터에서 실행, outlet-sites.sql·seed-israel-today.sql 다음)
--   한국 교육 뉴스 + 미국·해외 유학과 해외 교육 소식. 대표님 그룹(총관리자 그룹)에 매체를 만들고
--   홈페이지 설정(고급 네이비 색·슬로건·보도자료 교육 키워드·해외 교육 언론)과 1차·2차 메뉴를 넣는다
--   다시 실행해도 매체·섹션이 두 번 생기지 않는다 (이미 고친 홈페이지 설정은 덮어쓰지 않는다)
--   로고는 아직 없어 매체 이름 글자로 보여준다. 도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다
--
--   1차 메뉴(9): 교육정책 · 입시·진학 · 학교 · 대학 · 유학 · 미국교육 · 글로벌 · 에듀테크 · 오피니언
--   전문뉴스(유학·해외교육): 유학 · 미국교육 · 글로벌
--   보도자료함: 뉴스와이어 교육 분류(교육 일반·대학·초중등·유아·학원·온라인·직업교육) 추천 + 해외 교육·유학 언론

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

  select id into oid from outlets where name = '에듀와이드' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('에듀와이드', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'nameEn', 'EDUWIDE',
    'slogan', '교육을 넓게, 세계를 깊게',
    'sloganEn', 'KOREA · STUDY ABROAD · GLOBAL EDUCATION',
    'description', '한국 교육 뉴스와 미국·해외 유학 정보를 전하는 교육 전문 미디어',
    'specialtyTitle', '유학·해외교육',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#1A2E5A', 'accent', '#B8935A'),
    'indexable', false,
    'homeLayout', 'standard',
    'pressForeign', true,
    'pressForeignTopics', jsonb_build_array('education'),
    'pressKeywords', '교육, 학교, 학생, 학부모, 교사, 교원, 교육부, 교육청, 교육감, 교육과정, 대학, 대학교, 입시, 수능, 대입, 수시, 정시, 논술, 고입, 고교, 고등학교, 중학교, 초등, 유치원, 유아, 어린이집, 돌봄, 늘봄, 방과후, 학원, 사교육, 장학, 장학금, 유학, 유학생, 어학연수, 해외연수, 교환학생, 국제학교, IB, 영재, 진로, 진학, 취업, 평생교육, 직업교육, 학교밖, 검정고시, 에듀테크, 이러닝, 디지털교과서, AI교육, AI 교육, 코딩, 문해력, EBS, education, university, college, school, schools, student, students, teacher, teachers, campus, admissions, tuition, scholarship, visa, international, K-12, edtech, curriculum, enrollment, literacy',
    'legal', jsonb_build_object(
      'company', '에듀와이드', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', ''
    )
  )
  where id = oid and (site = '{}'::jsonb or site is null or site->>'nameEn' is null);

  -- 1차 메뉴 (sort_order 1~9). 유학·미국교육·글로벌은 첫 화면 '유학·해외교육' 전문뉴스 묶음
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('교육정책', 'policy', 1, false, '교육부·교육청 · 교원 · 학교제도 · 법령'),
    ('입시·진학', 'admission', 2, false, '수능 · 대입 · 고입 · 입시전략'),
    ('학교', 'school', 3, false, '유아 · 초등 · 중등 · 특수·대안 · 학부모'),
    ('대학', 'university', 4, false, '대학 소식 · 연구·산학 · 진로·취업 · 평생·직업교육'),
    ('유학', 'study-abroad', 5, true, '유학 가이드 · 비자·제도 · 장학금 · 어학연수 · 유학 생활'),
    ('미국교육', 'us-edu', 6, true, '미국 대학 · K-12 · 미국 입시 · 교육정책'),
    ('글로벌', 'global', 7, true, '영국·유럽 · 캐나다·호주 · 아시아 · 국제학교 · 국제교육 동향'),
    ('에듀테크', 'edutech', 8, false, 'AI 교육 · 디지털 교과서 · 이러닝'),
    ('오피니언', 'opinion', 9, false, '칼럼 · 인터뷰')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  -- 2차 메뉴 (상위 섹션 slug 를 parent_slug 에)
  insert into categories (outlet_id, name, slug, sort_order, specialty, parent_slug)
  select oid, s.name, s.slug, s.ord, false, s.parent
  from (values
    ('교육부·정책', 'policy-gov', 101, 'policy'), ('교육청', 'policy-office', 102, 'policy'), ('교원', 'policy-teachers', 103, 'policy'),
    ('학교제도·법령', 'policy-law', 104, 'policy'),
    ('수능', 'adm-csat', 201, 'admission'), ('대입', 'adm-college', 202, 'admission'), ('고입', 'adm-highschool', 203, 'admission'),
    ('입시전략', 'adm-strategy', 204, 'admission'),
    ('유아', 'school-early', 301, 'school'), ('초등', 'school-elementary', 302, 'school'), ('중등', 'school-secondary', 303, 'school'),
    ('특수·대안', 'school-special', 304, 'school'), ('학부모', 'school-parents', 305, 'school'),
    ('대학 소식', 'univ-news', 401, 'university'), ('연구·산학', 'univ-research', 402, 'university'), ('진로·취업', 'univ-career', 403, 'university'),
    ('평생·직업교육', 'univ-lifelong', 404, 'university'),
    ('유학 가이드', 'abroad-guide', 501, 'study-abroad'), ('비자·제도', 'abroad-visa', 502, 'study-abroad'), ('장학금', 'abroad-scholarship', 503, 'study-abroad'),
    ('어학연수', 'abroad-language', 504, 'study-abroad'), ('유학 생활', 'abroad-life', 505, 'study-abroad'),
    ('미국 대학', 'us-college', 601, 'us-edu'), ('미국 K-12', 'us-k12', 602, 'us-edu'), ('미국 입시', 'us-admission', 603, 'us-edu'),
    ('미국 교육정책', 'us-policy', 604, 'us-edu'),
    ('영국·유럽', 'global-europe', 701, 'global'), ('캐나다·호주', 'global-anglo', 702, 'global'), ('아시아', 'global-asia', 703, 'global'),
    ('국제학교', 'global-intl-school', 704, 'global'), ('국제교육 동향', 'global-trends', 705, 'global'),
    ('AI 교육', 'tech-ai', 801, 'edutech'), ('디지털 교과서', 'tech-textbook', 802, 'edutech'), ('이러닝', 'tech-elearning', 803, 'edutech'),
    ('칼럼', 'op-column', 901, 'opinion'), ('인터뷰', 'op-interview', 902, 'opinion')
  ) as s(name, slug, ord, parent)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice '에듀와이드 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name = '에듀와이드';
