-- 메일·직접 등록 보도자료가 어느 그룹에 보이는지 확인 (조회만 한다. 아무것도 바꾸지 않는다)
--   "보이는 범위"가 '모든 매체(공통)'이면 그룹이 없는 계정으로 들어온 자료라 어느 매체 편집장에게나 보인다
--   Breaking BCS 편집장에게 보이는지는 "Breaking BCS에 보임" 칸으로 본다
select r.fetched_at::date as "받은 날", r.source_key as "종류", r.source_name as "보낸 이름", left(r.title, 40) as "제목",
  coalesce(p.full_name, '(없음)') as "등록 계정",
  coalesce(pb.name, '모든 매체(공통)') as "보이는 범위",
  (r.publisher_id is null or r.publisher_id = (select o.publisher_id from outlets o where o.name = 'Breaking BCS' limit 1)) as "Breaking BCS에 보임"
from press_releases r
left join profiles p on p.id = r.created_by
left join publishers pb on pb.id = r.publisher_id
where r.source_key in ('email', 'manual')
order by r.fetched_at desc
limit 50;
