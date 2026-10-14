-- GDPA(글로벌디지털언론협회) 회원사 추가: 에듀와이드 · 다음세대타임즈 · The Statecraft Times
-- Supabase SQL 에디터에서 실행 (gdpa.sql·seed-eduwide.sql·seed-nextgentimes.sql·seed-statecrafttimes.sql 다음). 여러 번 실행해도 된다
--   이미 회원사인 매체는 건너뛴다. 매체가 아직 없으면(시드 SQL 미실행) 그 매체만 빠진다
--   협회 홈페이지 '회원사 소개'와 '회원사 뉴스'(회원사 최신 기사 모음)에 바로 나온다

insert into gdpa_member_outlets (outlet_id, sort_order, intro)
select o.id, x.ord, x.intro
from (values
  ('에듀와이드', 4, '한국 교육 뉴스와 미국·해외 유학 정보를 전하는 교육 전문 미디어'),
  ('다음세대타임즈', 5, '개혁주의 신앙에 서서 교회교육·기독교학교·가정 신앙교육을 전하는 기독교 교육 전문 미디어'),
  ('The Statecraft Times', 6, '국제정치·외교·안보·세계경제를 다루는 영문 국제정치 미디어')
) as x(name, ord, intro)
join outlets o on o.name = x.name
on conflict (outlet_id) do nothing;

-- 확인
select o.name as "회원사", m.sort_order as "순서", coalesce(o.domain, '(도메인 미연결)') as "도메인"
from gdpa_member_outlets m join outlets o on o.id = m.outlet_id order by m.sort_order;
