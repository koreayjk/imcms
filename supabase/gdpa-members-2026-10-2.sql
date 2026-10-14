-- GDPA(글로벌디지털언론협회) 회원사 추가: 치앙마이미션타임즈 (7번째 회원사)
-- Supabase SQL 에디터에서 실행 (gdpa.sql·seed-worldmissiontimes.sql 다음). 여러 번 실행해도 된다
--   매체 이름이 '치앙마이미션타임즈'든 '월드미션타임즈'든 찾아서 넣는다 (rename-worldmissiontimes.sql 로 이름을 바꿔도 협회 화면에는 지금 이름이 나온다)
--   이미 회원사면 건너뛴다. 매체가 아직 없으면 아무것도 넣지 않는다
--   협회 홈페이지 '회원사 소개'와 '회원사 뉴스'(회원사 최신 기사 모음)에 바로 나온다

insert into gdpa_member_outlets (outlet_id, sort_order, intro)
select o.id, 7, '태국 치앙마이에서 시작해 세계선교 동향과 선교 현장, 미전도 종족과 선교사 이야기를 전하는 선교 전문 미디어'
from outlets o
where o.name in ('치앙마이미션타임즈', '월드미션타임즈')
order by (o.name = '치앙마이미션타임즈') desc
limit 1
on conflict (outlet_id) do nothing;

-- 확인 (7곳이 나오면 된다)
select o.name as "회원사", m.sort_order as "순서", coalesce(o.domain, '(도메인 미연결)') as "도메인"
from gdpa_member_outlets m join outlets o on o.id = m.outlet_id order by m.sort_order;
