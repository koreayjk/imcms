-- 매체 홈페이지 설정을 DB로 (Supabase SQL 에디터에서 1회 실행, groups.sql 다음)
-- 로고·색·슬로건·하단 법정 표시 정보·검색 노출을 매체마다 저장하고, 발행인이 "홈페이지 설정" 화면에서 고친다

alter table outlets add column if not exists site jsonb not null default '{}'::jsonb;
alter table categories add column if not exists specialty boolean not null default false;
alter table categories add column if not exists description text;

-- 더케어타임즈: 지금까지 코드에 있던 설정을 그대로 옮긴다 (이미 설정이 있으면 건드리지 않음)
update outlets set site = jsonb_build_object(
  'nameEn', 'THE CARE TIMES',
  'slogan', '세상을 더 깊이, 사람을 더 가까이',
  'sloganEn', 'NEWS FOR A BETTER TOMORROW',
  'description', '보건·복지, 병원·의료, 요양·시니어케어, 돌봄산업 전문 인터넷신문',
  'logoUrl', '/sites/thecaretimes/logo-mark.png',
  'logoMode', 'mark',
  'colors', jsonb_build_object('brand', '#02472F', 'accent', '#D3A82B'),
  'indexable', false,
  'pressKeywords', '요양, 돌봄, 간병, 복지, 노인, 어르신, 시니어, 실버, 치매, 장애, 재활, 병원, 의료, 의원, 의사, 간호, 환자, 건강, 보건, 질병, 감염, 백신, 제약, 의약, 의료기기, 헬스케어, 건강보험, 장기요양, 호스피스, 임종',
  'legal', jsonb_build_object(
    'company', '더케어타임즈', 'ceo', '김경석', 'publisher', '김경석', 'editor', '김경석', 'youthOfficer', '김경석',
    'registrationNo', '경기, 아53782', 'registeredAt', '2023.09.04', 'bizNo', '779-14-02872',
    'postcode', '16566', 'address', '경기도 수원시 권선구 경수대로352번길 30, B1층 (권선동)',
    'phone', '010-2280-9089', 'email', 'thecaretimes@gmail.com'
  )
)
where domain = 'thecaretimes.net' and site = '{}'::jsonb;

update categories c set specialty = true, description = d.description
from (values
  ('health-welfare', '보건·복지 분야 전문 소식'),
  ('medical', '병원·의료기관 관련 정보'),
  ('senior-care', '요양병원·요양시설·시니어케어'),
  ('care-industry', '복지·돌봄산업 관련 소식')
) as d(slug, description), outlets o
where c.slug = d.slug and c.outlet_id = o.id and o.domain = 'thecaretimes.net' and c.description is null;

-- 도메인 하나에 매체 하나
create unique index if not exists outlets_domain_unique on outlets (lower(domain)) where domain is not null;
