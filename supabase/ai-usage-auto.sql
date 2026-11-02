-- 자동 작성(서버가 보도자료로 쓰는 AI 기사)의 이번 달 건수·비용을 AI 사용량 화면에 따로 보여 주는 읽기 전용 함수 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   자동 작성은 요금제 한도(ai_usage)에 넣지 않는다. 기록은 auto_press_log 에만 있고, 이 함수는 그것을 이번 달(한국 시간) 기준으로 센다.
--   실행 전이면 화면에 "자동 작성" 줄만 안 보인다. 다른 기능은 그대로.

-- 운영팀: 매체별 건수·비용 (성공한 건만 건수에 넣고, 실패한 시도의 비용도 합친다)
create or replace function public.ai_usage_auto_overview() returns table (outlet_id uuid, auto_count integer, auto_cost_usd numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception '운영팀만 볼 수 있습니다.'; end if;
  return query
    select l.outlet_id, (count(*) filter (where l.ok))::integer, coalesce(sum(l.cost_usd), 0)
    from auto_press_log l
    where l.created_at >= public.kst_month_start()
    group by l.outlet_id;
end $$;

-- 매체 한 곳 (그 매체를 볼 수 있는 사람)
create or replace function public.ai_usage_auto(o uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare n integer; c numeric;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  select (count(*) filter (where ok))::integer, coalesce(sum(cost_usd), 0) into n, c
  from auto_press_log where outlet_id = o and created_at >= public.kst_month_start();
  return jsonb_build_object('count', n, 'cost', c);
end $$;

revoke all on function public.ai_usage_auto_overview(), public.ai_usage_auto(uuid) from public, anon;
grant execute on function public.ai_usage_auto_overview(), public.ai_usage_auto(uuid) to authenticated;
