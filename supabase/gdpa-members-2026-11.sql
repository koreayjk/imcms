-- 협회(GDPA) 홈페이지 회원사 목록에 나머지 3개 매체 올리기 (2026-11-26)
--   GDPA 그룹 소속 12개 중 목록(gdpa_member_outlets)에 빠져 있던 치앙마이 타임즈·Breaking BCS·산청딸기 뉴스.
--   (필리핀 타임즈는 philippine-times-domain.sql 에서 먼저 올렸다.) 여러 번 실행해도 되게 만들었다.
insert into gdpa_member_outlets (outlet_id, sort_order, joined_on)
select v.id::uuid, (select coalesce(max(sort_order), 0) from gdpa_member_outlets) + v.n, date '2026-11-26'
from (values
  ('6c22aa1d-2146-4ae7-a7c3-6553219e5683', 1),  -- 치앙마이 타임즈
  ('265a2951-7a6e-4cde-96aa-d0ca9dbcdd67', 2),  -- Breaking BCS
  ('3bc3b331-b14a-4298-9987-708b203409a1', 3)   -- 산청딸기 뉴스
) as v(id, n)
where not exists (select 1 from gdpa_member_outlets g where g.outlet_id = v.id::uuid);

-- 확인용: 12개가 모두 나와야 한다
select count(*) as listed from gdpa_member_outlets;
