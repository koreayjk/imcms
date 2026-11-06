-- 필리핀 타임즈 섹션 8개 (말레이시아 타임즈와 같은 구성, 한-말 교류 → 한-필 교류)
-- 2026-11-06 운영 DB에 적용함: 비어 있던 정치·경제·사회·문화(기사 0건)는 이름을 바꿔 재사용하고 4개를 추가했다.
-- 여러 번 실행해도 된다 (같은 slug가 있으면 건너뛴다)
insert into categories (outlet_id, name, slug, sort_order)
select 'ef29ed60-306f-4aa0-87ea-c98a41a9929c', v.name, v.slug, v.so
from (values ('교육','education',0),('유학·생활','study',1),('비즈니스','business',2),('투자·산업','invest',3),
             ('정책·제도','policy',4),('관광','tour',5),('종교','religion',6),('한-필 교류','korea-philippines-cooperation',7)) v(name, slug, so)
where not exists (select 1 from categories c where c.outlet_id = 'ef29ed60-306f-4aa0-87ea-c98a41a9929c' and c.slug = v.slug);
