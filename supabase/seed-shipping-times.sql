-- Shipping Times (국제물류 전문 매체) 만들기 (Supabase SQL 에디터에서 1회 실행, outlet-sites.sql 다음)
--   대표님 그룹(총관리자 그룹)에 매체를 만들고, 홈페이지 설정(로고·색·슬로건·추천 키워드)과 섹션을 넣는다
--   다시 실행해도 매체가 두 번 생기지 않는다 (이름이 같은 매체가 있으면 설정만 맞춘다)
--   도메인은 정해지면 "매체 → 홈페이지 설정"에서 넣는다. 그 전에는 미리보기 주소로 본다

do $$
declare
  grp uuid;
  oid uuid;
begin
  -- 대표님 그룹: groups.sql이 만든 '총관리자 그룹' (없으면 만든다)
  select id into grp from publishers where name = '총관리자 그룹' order by created_at limit 1;
  if grp is null then
    insert into publishers (name) values ('총관리자 그룹') returning id into grp;
  end if;

  select id into oid from outlets where name = 'Shipping Times' limit 1;
  if oid is null then
    insert into outlets (name, domain, publisher_id) values ('Shipping Times', null, grp) returning id into oid;
  end if;

  update outlets set site = jsonb_build_object(
    'nameEn', 'SHIPPING TIMES',
    'slogan', '바다와 하늘을 잇는 물류의 내일',
    'sloganEn', 'GLOBAL LOGISTICS · MARITIME · TRADE',
    'description', '해운·항만·항공화물·포워딩·무역 전문 국제물류 미디어',
    'specialtyTitle', '국제물류 전문뉴스',
    'indexWidget', true,
    'logoUrl', '/sites/shippingtimes/logo-full.svg',
    'logoMode', 'full',
    'colors', jsonb_build_object('brand', '#0B4D3B', 'accent', '#B8975A'),
    'indexable', false,
    'pressKeywords', '해운, 선사, 선박, 컨테이너, 벌크, 탱커, 운임, 해상운임, 물류, 포워딩, 포워더, 3PL, 풀필먼트, 창고, 물류센터, 항만, 부두, 터미널, 부산항, 인천항, 광양항, 평택항, 울산항, 항만공사, 항공화물, 화물기, 항공물류, 공항, 통관, 관세, 관세청, 수출입, 수출, 수입, 무역, FTA, 공급망, 해양수산부, 해운협회, 해양진흥공사, 물동량, 조선, 해양, 항로, 운송, 택배, 콜드체인, SCFI, KCCI, BDI, HMM',
    'legal', jsonb_build_object(
      'company', 'Shipping Times', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', ''
    )
  )
  where id = oid and (site = '{}'::jsonb or site->>'logoUrl' is null);

  -- 섹션: KSG(코리아쉬핑가제트)의 해운·물류·항만·항공·무역 구성을 바탕으로, 포워더 편집장에 맞춰 물류·포워딩을 앞에 둔다
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('해운', 'shipping', 1, true, '컨테이너·벌크·탱커 선사와 해상운임'),
    ('물류·포워딩', 'logistics', 2, true, '포워딩·3PL·창고·풀필먼트·내륙운송'),
    ('항만', 'port', 3, true, '부산·인천·광양 등 국내외 항만과 터미널'),
    ('항공화물', 'air-cargo', 4, true, '항공사 화물·공항 물류·특송'),
    ('무역·통관', 'trade', 5, true, '수출입·관세·FTA·통관 제도'),
    ('조선·해양', 'shipbuilding', 6, false, null),
    ('인사·동정', 'people', 7, false, null),
    ('오피니언', 'opinion', 8, false, null)
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  raise notice 'Shipping Times 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 미리보기 주소 확인용
select id as "매체 ID", 'https://imcms.vercel.app/?preview_outlet=' || id as "미리보기 주소" from outlets where name = 'Shipping Times';
