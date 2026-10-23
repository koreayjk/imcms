-- 개통 현황 새 소식 표시 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. launch-hub.sql 다음)
--   운영팀이 코멘트를 쓰거나 체크 항목을 체크하면, 고객의 왼쪽 메뉴 "개통 현황"에 새 소식 숫자가 뜬다.
--   고객이 개통 현황을 열면(확인) 사람마다 숫자가 지워진다.

create table if not exists launch_reads (
  outlet_id uuid not null references outlets(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (outlet_id, user_id)
);
alter table launch_reads enable row level security;
drop policy if exists "launch_reads_own" on launch_reads;
create policy "launch_reads_own" on launch_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 내가 마지막으로 연 뒤에 생긴 새 소식 수: 운영팀 코멘트 + 새로 체크된 항목 (표시·선택용 항목은 뺀다)
create or replace function public.launch_unseen(o uuid) returns integer
language sql stable security definer set search_path = public as $$
  with seen as (select coalesce((select r.seen_at from launch_reads r where r.outlet_id = o and r.user_id = auth.uid()), 'epoch'::timestamptz) as t)
  select case when public.can_view_outlet(o) and not public.is_staff() then
    (select count(*)::int from launch_comments c, seen where c.outlet_id = o and c.from_staff and c.created_at > seen.t)
    + (select count(*)::int from launch_checklists l, jsonb_each_text(l.done) e, seen
        where l.outlet_id = o and e.key not in ('fresh_start', 'kakao_domain') and e.value ~ '^\d{4}-' and e.value::timestamptz > seen.t)
  else 0 end;
$$;
grant execute on function public.launch_unseen(uuid) to authenticated;

-- 개통 현황을 열었다고 기록 (숫자가 지워진다)
create or replace function public.launch_mark_seen(o uuid) returns void
language sql security definer set search_path = public as $$
  insert into launch_reads (outlet_id, user_id, seen_at)
  select o, auth.uid(), now() where public.can_view_outlet(o) and auth.uid() is not null
  on conflict (outlet_id, user_id) do update set seen_at = now();
$$;
grant execute on function public.launch_mark_seen(uuid) to authenticated;

select '개통 현황 새 소식 표시' as "기능",
  case when to_regproc('public.launch_unseen(uuid)') is not null then '준비됨' else '아직 안 됨' end as "결과";
