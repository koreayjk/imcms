-- GDPA(글로벌디지털언론협회) 회원사 정리: 뉴스폭탄 뺌, Malaysia Times 추가 (8번째 회원사)
-- Supabase SQL 에디터에서 실행 (gdpa.sql 다음). 여러 번 실행해도 된다
--   · 뉴스폭탄은 GDPA 그룹이 아니므로 회원사에서 뺀다 (앞서 넣었다면 지워지고, 안 넣었으면 아무 일도 없다)
--   · Malaysia Times(말레이시아 타임즈)를 넣는다. 이미 회원사면 건너뛰고, 매체가 없으면 아무것도 넣지 않는다
--   · 협회 홈페이지 '회원사 소개'와 '회원사 뉴스'(회원사 최신 기사 모음)에 바로 나온다
--   · 소개 문구는 아래 한 줄을 고쳐 실행하면 된다

delete from gdpa_member_outlets
where outlet_id in (select id from outlets where name = '뉴스폭탄');

insert into gdpa_member_outlets (outlet_id, sort_order, intro)
select o.id, 8, '말레이시아의 교육 정책과 유학 제도, 경제·투자·산업 소식을 전하는 말레이시아 교육·비즈니스 전문 미디어'
from outlets o
where o.name in ('Malaysia Times', '말레이시아 타임즈', '말레이시아타임즈') or o.name ilike '%말레이시아%타임즈%' or o.name ilike 'malaysia%times%'
order by o.created_at
limit 1
on conflict (outlet_id) do nothing;

-- 확인 (8곳이 나오고 뉴스폭탄이 없으면 된다)
select o.name as "회원사", m.sort_order as "순서", coalesce(o.domain, '(도메인 미연결)') as "도메인"
from gdpa_member_outlets m join outlets o on o.id = m.outlet_id order by m.sort_order;
