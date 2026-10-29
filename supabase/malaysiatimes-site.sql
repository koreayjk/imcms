-- 말레이시아 타임즈 홈페이지 설정·섹션 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   말레이시아의 교육과 비즈니스를 다루는 한국어 매체. 독자: 말레이시아 유학·교육 사업·진출에 관심 있는 한국 독자
--   · 홈페이지 설정: 영문 이름·슬로건·소개·색·전문뉴스 제목·숫자 판(숫자로 보는 말레이시아)·AI 활용 표시·법정 표기의 회사명과 편집인(Johan)
--     이미 값이 있는 칸은 덮어쓰지 않는다 ("오픈 준비 중"도 그대로). 비어 있는 칸(빈 글자)은 채운다
--     ※ 실행 전에 열어 둔 홈페이지 설정 화면은 새로고침한 뒤 저장한다 (예전 화면 값으로 저장하면 이 설정이 빈 값으로 덮인다)
--   · 1차 메뉴 6개: 교육 · 유학·생활 · 비즈니스 · 투자·산업 · 정책·제도 · 한-말 교류
--     개설 때 자동으로 생긴 정치·경제·사회·문화는 기사가 없을 때만 지운다
--   · 숫자 판 값은 2026-10-29 기준 공식 발표. 새 통계가 나오면 홈페이지 설정 → '숫자 판'에서 고친다
--     (이 파일을 다시 실행해도 이미 있는 숫자 판은 덮어쓰지 않는다)
--   · 다음 순서: supabase/seed-articles/malaysiatimes-2026-10.sql (기사 50건)

alter table categories add column if not exists parent_slug text;

do $$
declare
  oid uuid;
  n int;
begin
  select count(*) into n from outlets
  where name in ('말레이시아 타임즈', '말레이시아타임즈') or name ilike '%말레이시아%타임즈%' or name ilike '%malaysia%times%';
  if n = 0 then raise exception '말레이시아 타임즈 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.'; end if;
  if n > 1 then raise exception '말레이시아 타임즈로 보이는 매체가 %개입니다. 하나만 남기거나 이 파일의 이름을 정확히 고쳐 주세요.', n; end if;
  select id into oid from outlets
  where name in ('말레이시아 타임즈', '말레이시아타임즈') or name ilike '%말레이시아%타임즈%' or name ilike '%malaysia%times%';

  -- 홈페이지 설정: 기본값 || 지금 설정 (지금 설정에 값이 있는 칸이 이긴다. 빈 글자·빈 칸은 기본값으로 채운다)
  update outlets set site = jsonb_build_object(
    'nameEn', 'MALAYSIA TIMES',
    'slogan', '말레이시아의 교육과 비즈니스를 읽다',
    'sloganEn', 'EDUCATION AND BUSINESS IN MALAYSIA',
    'description', '말레이시아의 교육 정책과 유학 제도, 경제·투자·산업 소식을 전하는 뉴스. 말레이시아 유학과 교육 사업, 현지 진출에 관심 있는 한국 독자를 위해 공식 자료를 바탕으로 씁니다.',
    'specialtyTitle', '교육·유학',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#0B3C5D', 'accent', '#D4A017'),
    'homeLayout', 'standard',
    'lang', 'ko',
    'aiNotice', jsonb_build_object('on', true, 'text', '이 기사는 공개된 공식 자료를 바탕으로 AI의 도움을 받아 작성했습니다.'),
    'statsBoard', '{"title": "숫자로 보는 말레이시아", "items": [{"label": "기준금리(OPR)", "value": "2.75%", "note": "2026년 9월 3일 통화정책위원회, 동결", "source": "말레이시아 중앙은행(BNM)", "url": "https://www.bnm.gov.my/-/monetary-policy-statement-03092026"}, {"label": "GDP 성장률(3분기 속보치)", "value": "5.3%", "note": "2026년 3분기, 전년 동기 대비. 2분기 확정치는 6.0%", "source": "말레이시아 통계청(DOSM)", "url": "https://www.dosm.gov.my/portal-main/release-content/advance-gross-domestic-product-gdp-estimates-q32026"}, {"label": "소비자물가 상승률", "value": "1.8%", "note": "2026년 9월, 전년 동월 대비", "source": "말레이시아 통계청(DOSM)", "url": "https://www.dosm.gov.my/portal-main/release-content/consumer-price-index-sep2026"}, {"label": "수출 증감률", "value": "+54.5%", "note": "2026년 9월, 전년 동월 대비, 수출액 2,151억 링깃", "source": "말레이시아 통계청(DOSM)", "url": "https://www.dosm.gov.my/portal-main/release-content/monthly-external-trade-statistics-sep2026"}, {"label": "승인 투자액", "value": "2,185억 링깃", "note": "2026년 상반기, 전년 동기 대비 11.7% 증가, 2,746건", "source": "말레이시아 투자청(MIDA)", "url": "https://www.mida.gov.my/media-release/malaysia-secures-rm218-5-billion-in-approved-investments-in-1h-2026-with-domestic-investment-in-manufacturing-up-23/"}], "footnote": "각 기관 공식 발표 원문에서 확인한 최신 값(2026년 10월 29일 기준). GDP 3분기 값은 속보치라 확정치 발표 때 달라질 수 있다. 승인 투자액은 MIDA의 승인 기준이며 통계청의 외국인직접투자(FDI) 통계와 다르다."}'::jsonb
  ) || (select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb) from jsonb_each(coalesce(site, '{}'::jsonb)) as e(k, v)
         where e.v not in ('""'::jsonb, 'null'::jsonb, '{}'::jsonb))
  where id = oid;

  -- 법정 표기: 비어 있는 칸만 (등록번호·발행인·주소·연락처 등은 고객이 홈페이지 설정에서 넣는다)
  update outlets set site = jsonb_set(site, '{legal}',
    jsonb_build_object('company', '', 'ceo', '', 'publisher', '', 'editor', '', 'youthOfficer', '',
      'registrationNo', '', 'registeredAt', '', 'bizNo', '', 'postcode', '', 'address', '', 'phone', '', 'email', '')
    || coalesce(site->'legal', '{}'::jsonb))
  where id = oid;
  update outlets set site = jsonb_set(site, '{legal,company}', to_jsonb(name))
  where id = oid and coalesce(site->'legal'->>'company', '') = '';
  update outlets set site = jsonb_set(site, '{legal,editor}', to_jsonb('Johan'::text))
  where id = oid and coalesce(site->'legal'->>'editor', '') = '';

  -- 1차 메뉴 (이미 있는 slug 는 이름·순서·설명만 맞춘다)
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('교육', 'education', 1, true, '말레이시아 교육 정책 · 고등교육부·교육부 발표 · 대학·직업교육 · 시험과 통계'),
    ('유학·생활', 'study', 2, true, '학생비자 · 입학·인증 · 국제학교 · 분교 캠퍼스 · 유학 생활 정보'),
    ('비즈니스', 'business', 3, false, '말레이시아 경제·산업 동향 · 금리·물가·무역 · 주요 산업'),
    ('투자·산업', 'invest', 4, false, '투자청(MIDA) · 외국인 직접투자 · 산업단지·경제특구 · 산업 정책'),
    ('정책·제도', 'policy', 5, false, '외국인 고용·비자 · 법인 설립 · 세금 · 규제 변경'),
    ('한-말 교류', 'korea', 6, false, '한국·말레이시아 교역 · 정부 협력 · 교육 교류 · 한국 기업 진출')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  update categories c set name = s.name, sort_order = s.ord, specialty = s.specialty, description = s.description
  from (values
    ('교육', 'education', 1, true, '말레이시아 교육 정책 · 고등교육부·교육부 발표 · 대학·직업교육 · 시험과 통계'),
    ('유학·생활', 'study', 2, true, '학생비자 · 입학·인증 · 국제학교 · 분교 캠퍼스 · 유학 생활 정보'),
    ('비즈니스', 'business', 3, false, '말레이시아 경제·산업 동향 · 금리·물가·무역 · 주요 산업'),
    ('투자·산업', 'invest', 4, false, '투자청(MIDA) · 외국인 직접투자 · 산업단지·경제특구 · 산업 정책'),
    ('정책·제도', 'policy', 5, false, '외국인 고용·비자 · 법인 설립 · 세금 · 규제 변경'),
    ('한-말 교류', 'korea', 6, false, '한국·말레이시아 교역 · 정부 협력 · 교육 교류 · 한국 기업 진출')
  ) as s(name, slug, ord, specialty, description)
  where c.outlet_id = oid and c.slug = s.slug;

  -- 개설 때 생긴 기본 섹션 가운데 이 매체에 안 쓰는 것 (기사가 없을 때만)
  delete from categories c
  where c.outlet_id = oid and c.slug in ('politics', 'economy', 'society', 'culture')
    and not exists (select 1 from articles a where a.category_id = c.id);

  raise notice '말레이시아 타임즈 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 확인
select o.name as "매체", o.site->>'nameEn' as "영문 이름", o.site->>'comingSoon' as "오픈 준비 중",
  o.site->'legal'->>'editor' as "편집인",
  (select string_agg(c.name, ' · ' order by c.sort_order) from categories c where c.outlet_id = o.id and c.parent_slug is null) as "1차 메뉴"
from outlets o
where o.name in ('말레이시아 타임즈', '말레이시아타임즈') or o.name ilike '%말레이시아%타임즈%' or o.name ilike '%malaysia%times%';
