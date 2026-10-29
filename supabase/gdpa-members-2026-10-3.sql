-- GDPA(글로벌디지털언론협회) 회원사 추가: 뉴스폭탄 (8번째 회원사)
-- Supabase SQL 에디터에서 실행 (gdpa.sql 다음). 여러 번 실행해도 된다
--   이미 회원사면 건너뛴다. 매체가 아직 없으면 아무것도 넣지 않는다
--   협회 홈페이지 '회원사 소개'와 '회원사 뉴스'(회원사 최신 기사 모음)에 바로 나온다
--   소개 문구는 아래 한 줄을 고쳐 실행하면 된다 (이미 들어간 뒤에 바꾸려면 맨 아래 update 를 쓴다)

insert into gdpa_member_outlets (outlet_id, sort_order, intro)
select o.id, 8, '경기도 시·군 소식을 중심으로 정치·경제·사회·문화와 4차산업까지 전하는 종합 인터넷신문'
from outlets o
where o.name = '뉴스폭탄'
limit 1
on conflict (outlet_id) do nothing;

-- (선택) 소개 문구를 바꾸고 싶을 때
-- update gdpa_member_outlets set intro = '여기에 새 소개 문구' where outlet_id = (select id from outlets where name = '뉴스폭탄' limit 1);

-- 확인 (8곳이 나오면 된다)
select o.name as "회원사", m.sort_order as "순서", coalesce(o.domain, '(도메인 미연결)') as "도메인"
from gdpa_member_outlets m join outlets o on o.id = m.outlet_id order by m.sort_order;
