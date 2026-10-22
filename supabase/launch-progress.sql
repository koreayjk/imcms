-- 고객용 개통 진행 현황 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. launch-checklist.sql 다음)
--   launch_checklists 표는 운영팀만 읽을 수 있다. 고객(발행인·편집장·기자)은 자기 매체의 "끝낸 항목 목록"만
--   이 함수로 본다 (운영팀 메모·작성자·시각은 주지 않는다). 매체를 볼 수 있는 사람만 결과가 나온다.

create or replace function public.launch_progress(o uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when public.can_view_outlet(o)
    then coalesce((select array_agg(k) from launch_checklists l, jsonb_object_keys(l.done) k where l.outlet_id = o), '{}'::text[])
    else '{}'::text[]
  end;
$$;
grant execute on function public.launch_progress(uuid) to authenticated;

-- 확인
select '고객용 개통 진행 현황' as "기능",
  case when to_regproc('public.launch_progress(uuid)') is not null then '준비됨' else '아직 안 됨' end as "결과";
