-- 자동 기사 수집처 추가: 태국·말레이시아·해운·한국 교계 언론 묶음을 해당 매체에 켠다 (코드 배포 뒤 1회 실행, auto-press-articles.sql 다음)
--   치앙마이 타임즈 → 태국 언론 / 치앙마이미션타임즈 → 태국 언론 + 한국 교계 언론 / 말레이시아 타임즈 → 말레이시아 언론
--   Shipping Times → 해운·물류 업계 언론 / 다음세대타임즈 → 한국 교계 언론
-- 이미 켜져 있으면 중복 없이 그대로 둔다. 새 출처는 30분마다 도는 수집(press-collect)이 다음 실행 때 가져온다.
update outlets o
set site = jsonb_set(
  coalesce(o.site, '{}'::jsonb),
  '{pressForeignTopics}',
  (select coalesce(jsonb_agg(distinct t), '[]'::jsonb)
   from jsonb_array_elements_text(coalesce(o.site->'pressForeignTopics', '[]'::jsonb) || v.topics) t),
  true)
|| jsonb_build_object('pressForeign', true)
from (values
  ('치앙마이 타임즈',     '["thailand"]'::jsonb),
  ('치앙마이미션타임즈',  '["thailand","kchurch"]'::jsonb),
  ('말레이시아 타임즈',   '["malaysia"]'::jsonb),
  ('Shipping Times',      '["shipping"]'::jsonb),
  ('다음세대타임즈',      '["kchurch"]'::jsonb)
) as v(name, topics)
where o.name = v.name;

select name, site->'pressForeignTopics' as topics from outlets
where name in ('치앙마이 타임즈','치앙마이미션타임즈','말레이시아 타임즈','Shipping Times','다음세대타임즈') order by name;
