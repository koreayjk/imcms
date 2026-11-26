-- 필리핀 타임즈: 임시 주소(philippinetimes.vercel.app) 연결 + 협회(GDPA) 홈페이지 회원사 목록에 올리기 (2026-11-26)
--   Vercel 프로젝트 imcms 에 도메인 philippinetimes.vercel.app 를 먼저 추가했다 (다른 vercel.app 주소와 같은 방식).
--   여러 번 실행해도 되게 만들었다.
update outlets set domain = 'philippinetimes.vercel.app'
where id = 'ef29ed60-306f-4aa0-87ea-c98a41a9929c' and name = '필리핀 타임즈' and domain is null;

insert into gdpa_member_outlets (outlet_id, sort_order, joined_on)
select 'ef29ed60-306f-4aa0-87ea-c98a41a9929c', (select coalesce(max(sort_order), 0) + 1 from gdpa_member_outlets), date '2026-11-26'
where not exists (select 1 from gdpa_member_outlets where outlet_id = 'ef29ed60-306f-4aa0-87ea-c98a41a9929c');

-- 확인용
select o.name, o.domain, g.sort_order, g.joined_on from outlets o left join gdpa_member_outlets g on g.outlet_id = o.id where o.id = 'ef29ed60-306f-4aa0-87ea-c98a41a9929c';
