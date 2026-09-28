-- 더케어타임즈 매체·섹션 등록 (Supabase SQL 에디터에서 1회 실행)
-- 섹션 slug는 lib/sites.ts 의 sections 와 같아야 홈페이지에 표시된다

with outlet as (
  insert into outlets (name, domain)
  values ('더케어타임즈', 'thecaretimes.net')
  returning id
)
insert into categories (outlet_id, name, slug, sort_order)
select outlet.id, c.name, c.slug, c.sort_order
from outlet, (values
  ('정치', 'politics', 1),
  ('경제', 'economy', 2),
  ('사회', 'society', 3),
  ('문화', 'culture', 4),
  ('보건·복지', 'health-welfare', 5),
  ('병원·의료', 'medical', 6),
  ('요양·시니어케어', 'senior-care', 7),
  ('돌봄산업', 'care-industry', 8)
) as c(name, slug, sort_order);
