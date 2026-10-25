-- 치앙마이 타임즈 홈페이지 설정·섹션 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   치앙마이를 중심으로 태국 전반을 다루는 비즈니스 매체 (한국어). 독자: 태국에 관심 있는 한국·태국·미국 사업가
--   · 홈페이지 설정: 영문 이름·슬로건·소개·색·전문뉴스 제목·숫자 판(숫자로 보는 태국 경제)·AI 활용 표시·법정 표기의 회사명과 편집인(Sarah Sorna)
--     이미 값이 있는 칸은 덮어쓰지 않는다 ("오픈 준비 중"도 그대로). 비어 있는 칸(빈 글자)은 채운다
--     ※ 실행 전에 열어 둔 홈페이지 설정 화면은 새로고침한 뒤 저장한다 (예전 화면 값으로 저장하면 이 설정이 빈 값으로 덮인다)
--   · 1차 메뉴 7개: 비즈니스 · 치앙마이 · 경제 · 투자 · 정책·제도 · 관광·라이프 · 글로벌
--     개설 때 자동으로 생긴 정치·사회·문화는 기사가 없을 때만 지운다 (경제는 그대로 쓴다)
--   · 숫자 판 값은 2026-10-24 기준 공식 발표. 새 통계가 나오면 홈페이지 설정 → '숫자 판'에서 고친다
--     (이 파일을 다시 실행해도 이미 있는 숫자 판은 덮어쓰지 않는다)
--   · 다음 순서: supabase/seed-articles/chiangmaitimes-2026-10.sql (기사 50건)

alter table categories add column if not exists parent_slug text;

do $$
declare
  oid uuid;
  n int;
begin
  select count(*) into n from outlets
  where name in ('치앙마이 타임즈', '치앙마이타임즈') or (name ilike '%치앙마이%타임즈%' and name not ilike '%미션%');
  if n = 0 then raise exception '치앙마이 타임즈 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.'; end if;
  if n > 1 then raise exception '치앙마이 타임즈로 보이는 매체가 %개입니다. 하나만 남기거나 이 파일의 이름을 정확히 고쳐 주세요.', n; end if;
  select id into oid from outlets
  where name in ('치앙마이 타임즈', '치앙마이타임즈') or (name ilike '%치앙마이%타임즈%' and name not ilike '%미션%');

  -- 홈페이지 설정: 기본값 || 지금 설정 (지금 설정에 값이 있는 칸이 이긴다. 빈 글자·빈 칸은 기본값으로 채운다)
  update outlets set site = jsonb_build_object(
    'nameEn', 'CHIANG MAI TIMES',
    'slogan', '치앙마이에서 읽는 태국 비즈니스',
    'sloganEn', 'THAILAND BUSINESS FROM CHIANG MAI',
    'description', '치앙마이를 중심으로 태국의 경제·투자·산업·제도 소식을 전하는 비즈니스 뉴스. 태국에서 사업하거나 사업을 준비하는 한국·태국·미국 독자를 위해 공식 자료를 바탕으로 씁니다.',
    'specialtyTitle', '치앙마이 비즈니스',
    'logoMode', 'text',
    'colors', jsonb_build_object('brand', '#6B1E2E', 'accent', '#C8962E'),
    'homeLayout', 'standard',
    'lang', 'ko',
    'aiNotice', jsonb_build_object('on', true, 'text', '이 기사는 공개된 공식 자료를 바탕으로 AI의 도움을 받아 작성했습니다.'),
    'statsBoard', '{"title": "숫자로 보는 태국 경제", "items": [{"label": "기준금리", "value": "1.00%", "note": "2026년 8월 26일 동결 · 다음 결정 10월 28일", "source": "태국중앙은행", "url": "https://www.bot.or.th/en/news-and-media/news/mpc/news-20260826-KsecaE98.html"}, {"label": "소비자물가 상승률", "value": "2.82%", "note": "2026년 9월, 1년 전 대비", "source": "태국 상무부 무역정책전략사무국", "url": "https://uploads.tpso.go.th/economic/pdf/Cpig092569_tg.pdf"}, {"label": "수출 증가율", "value": "+24.3%", "note": "2026년 8월, 1년 전 대비(달러 기준)", "source": "태국 상무부 무역정책전략사무국", "url": "https://uploads.tpso.go.th/editor/pdf/1790327282_f950231b17a8ec6485f0.pdf"}, {"label": "외국인 관광객", "value": "2,319만 명", "note": "2026년 1~9월 누적(잠정), 1년 전보다 3.8% 감소", "source": "태국 관광체육부", "url": "https://www.mots.go.th/news/category/817"}, {"label": "가계부채", "value": "GDP 대비 85.2%", "note": "2026년 2분기 말(잠정)", "source": "태국중앙은행", "url": "https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx?language=ENG&reportID=1004"}], "footnote": "각 기관 공식 발표 기준(2026년 10월 24일 확인). 잠정치는 바뀔 수 있다."}'::jsonb
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
  update outlets set site = jsonb_set(site, '{legal,editor}', to_jsonb('Sarah Sorna'::text))
  where id = oid and coalesce(site->'legal'->>'editor', '') = '';

  -- 1차 메뉴 (이미 있는 slug 는 이름·순서·설명만 맞춘다)
  insert into categories (outlet_id, name, slug, sort_order, specialty, description)
  select oid, s.name, s.slug, s.ord, s.specialty, s.description
  from (values
    ('비즈니스', 'business', 1, false, '산업·업종 동향 · 기업 환경 · 스타트업·중소기업 · 디지털 경제'),
    ('치앙마이', 'chiangmai', 2, true, '치앙마이·태국 북부 경제 · 인프라 · 지역 산업 · 장기체류'),
    ('경제', 'economy', 3, false, '태국 거시경제 · 금리·물가 · 수출입 · 정부 경제정책'),
    ('투자', 'invest', 4, false, '태국 투자청(BOI) · 동부경제회랑(EEC) · 외국인 직접투자 · 증시'),
    ('정책·제도', 'policy', 5, false, '외국인 사업 규정 · 법인 설립 · 비자·워크퍼밋 · 세금'),
    ('관광·라이프', 'travel', 6, false, '관광 산업·통계 · 항공 · 축제·행사 · 생활 정보'),
    ('글로벌', 'global', 7, false, '한국·미국과 태국 · 교역·협정 · 아세안')
  ) as s(name, slug, ord, specialty, description)
  where not exists (select 1 from categories c where c.outlet_id = oid and c.slug = s.slug);

  update categories c set name = s.name, sort_order = s.ord, specialty = s.specialty, description = s.description
  from (values
    ('경제', 'economy', 3, false, '태국 거시경제 · 금리·물가 · 수출입 · 정부 경제정책')
  ) as s(name, slug, ord, specialty, description)
  where c.outlet_id = oid and c.slug = s.slug;

  -- 개설 때 생긴 기본 섹션 가운데 이 매체에 안 쓰는 것 (기사가 없을 때만)
  delete from categories c
  where c.outlet_id = oid and c.slug in ('politics', 'society', 'culture')
    and not exists (select 1 from articles a where a.category_id = c.id);

  raise notice '치앙마이 타임즈 매체 ID: %  (미리보기: https://imcms.vercel.app/?preview_outlet=%)', oid, oid;
end $$;

-- 확인
select o.name as "매체", o.site->>'nameEn' as "영문 이름", o.site->>'comingSoon' as "오픈 준비 중",
  o.site->'legal'->>'editor' as "편집인",
  (select string_agg(c.name, ' · ' order by c.sort_order) from categories c where c.outlet_id = o.id and c.parent_slug is null) as "1차 메뉴"
from outlets o
where o.name in ('치앙마이 타임즈', '치앙마이타임즈') or (o.name ilike '%치앙마이%타임즈%' and o.name not ilike '%미션%');
