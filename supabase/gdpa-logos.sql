-- GDPA 소속 매체 8곳에 로고 연결 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   더케어타임즈·Israel Today 는 이미 로고가 있어 건드리지 않는다
--   로고 파일은 저장소 public/sites/<매체>/ 에 있다 (배포가 끝난 뒤에 보인다)
--   로고 표시 방식을 '로고 이미지(full)'로 바꾼다: 심볼 + 이름이 들어 있는 이미지 한 장이 머리글에 나온다
--   (홈페이지 설정에서 '심볼 + 이름 글자'로 바꾸려면 로고 파일을 logo-mark.svg 로 두고 표시 방식만 바꾼다)
--   Shipping Times 는 예전 로고 파일(logo-full.svg)이 그대로 있고, 새 로고는 logo-new-*.svg 다.
--     예전 것으로 되돌리려면 아래 맨 끝 주석의 SQL 을 쓴다
update outlets o set site = coalesce(o.site, '{}'::jsonb) || jsonb_build_object('logoUrl', v.url, 'logoMode', 'full')
from (values
  ('Shipping Times',       '/sites/shippingtimes/logo-new-full.svg'),
  ('에듀와이드',           '/sites/eduwide/logo-full.svg'),
  ('다음세대타임즈',       '/sites/nextgentimes/logo-full.svg'),
  ('The Statecraft Times', '/sites/statecrafttimes/logo-full.svg'),
  ('치앙마이미션타임즈',   '/sites/worldmissiontimes/logo-full.svg'),
  ('치앙마이 타임즈',      '/sites/chiangmaitimes/logo-full.svg'),
  ('Breaking BCS',         '/sites/breakingbcs/logo-full.svg'),
  ('Malaysia Times',       '/sites/malaysiatimes/logo-full.svg')
) as v(name, url)
where o.name = v.name;

-- 확인: 8곳과 Israel Today(원래 있던 로고) 모두 9줄이 나와야 한다 (빠진 매체가 있으면 이름이 다른 것이니 알려 주세요)
select o.name as "매체", o.site->>'logoUrl' as "로고", o.site->>'logoMode' as "표시 방식"
from outlets o
where o.site->>'logoUrl' like '/sites/%/logo-%full.svg'
order by o.name;

-- 되돌리기 (Shipping Times 예전 로고):
--   update outlets set site = site || '{"logoUrl": "/sites/shippingtimes/logo-full.svg", "logoMode": "full"}'::jsonb where name = 'Shipping Times';
