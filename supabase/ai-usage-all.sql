-- AI 사용 한도에 초안과 법적 검수를 함께 센다 · 요금제 기본 한도 300 / 900 / 2,000회
-- (Supabase SQL 에디터에서 실행, newsroom-settings.sql 다음. 여러 번 실행해도 된다)
--   AI 기사 초안 1번 = 1회, 승인신청·발행 전 AI 법적 검수 1번 = 1회
--   내용이 바뀌지 않아 저장된 검수 결과를 다시 쓰는 경우는 AI를 부르지 않으므로 세지 않는다
--   기자별 한도(자동 배분·편집장 지정)도 두 가지를 합쳐서 본다

create or replace function public.ai_limit_of(o uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(ai_monthly_limit, case plan when 'basic' then 300 when 'standard' then 900 when 'premium' then 2000 end)
  from outlets where id = o;
$$;

-- 이번 달 사용 현황: 매체 전체 + 내 몫 (초안·검수 합계, 나눠 본 숫자도 함께)
create or replace function public.ai_usage_status(o uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  drafts integer;
  ov boolean;
  pl text;
  my_used integer;
  my_lim integer;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  select plan, ai_overage into pl, ov from outlets where id = o;
  lim := public.ai_limit_of(o);
  select count(*), count(*) filter (where kind = 'draft') into used, drafts
  from ai_usage where outlet_id = o and created_at >= public.kst_month_start();
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and created_at >= public.kst_month_start();
  my_lim := public.ai_member_limit_of(o, auth.uid());
  return jsonb_build_object('plan', pl, 'limit', lim, 'used', used, 'drafts', drafts, 'legal', used - drafts, 'overage', coalesce(ov, false),
    'over', greatest(0, used - coalesce(lim, used)), 'mine_used', my_used, 'mine_limit', my_lim);
end $$;

-- AI 한 번 쓰기 직전에 한 건을 잡는다 (p_kind: draft = 초안, legal = 법적 검수). 내 한도 → 매체 한도 순서
create or replace function public.ai_usage_reserve(o uuid, p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  ov boolean;
  new_id bigint;
  is_over boolean;
  my_used integer;
  my_lim integer;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_kind is null or p_kind not in ('draft', 'legal') then raise exception '지원하지 않는 AI 사용입니다.'; end if;
  if not coalesce(public.can_view_outlet(o), false) then raise exception '이 매체에서 AI를 쓸 권한이 없습니다.'; end if;
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || o::text));
  my_lim := public.ai_member_limit_of(o, auth.uid());
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and created_at >= public.kst_month_start();
  if my_lim is not null and my_used >= my_lim then
    return jsonb_build_object('ok', false, 'scope', 'member', 'used', my_used, 'limit', my_lim);
  end if;
  lim := public.ai_limit_of(o);
  select coalesce(ai_overage, false) into ov from outlets where id = o;
  select count(*) into used from ai_usage where outlet_id = o and created_at >= public.kst_month_start();
  is_over := lim is not null and used >= lim;
  if is_over and not ov then
    return jsonb_build_object('ok', false, 'scope', 'outlet', 'used', used, 'limit', lim);
  end if;
  insert into ai_usage (outlet_id, user_id, over_limit, kind) values (o, auth.uid(), is_over, p_kind) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'used', used + 1, 'limit', lim, 'over_limit', is_over, 'mine_used', my_used + 1, 'mine_limit', my_lim);
end $$;

-- 예전 호출(인자 하나)은 초안으로 본다
create or replace function public.ai_usage_reserve(o uuid) returns jsonb language sql security definer set search_path = public as $$
  select public.ai_usage_reserve(o, 'draft');
$$;

-- 운영팀 개요: 초안·검수 합계
create or replace function public.ai_usage_overview() returns table (outlet_id uuid, outlet_name text, plan text, lim integer, used integer, over_count integer, overage boolean, cost_usd numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception '운영팀만 볼 수 있습니다.'; end if;
  return query
    select o.id, o.name, o.plan, public.ai_limit_of(o.id),
      count(u.id)::integer, count(u.id) filter (where u.over_limit)::integer, o.ai_overage, coalesce(sum(u.cost_usd), 0)
    from outlets o
    left join ai_usage u on u.outlet_id = o.id and u.created_at >= public.kst_month_start()
    group by o.id order by count(u.id) desc, o.name;
end $$;

revoke all on function public.ai_usage_reserve(uuid, text), public.ai_usage_reserve(uuid) from public, anon;
grant execute on function public.ai_usage_reserve(uuid, text), public.ai_usage_reserve(uuid), public.ai_usage_status(uuid),
  public.ai_usage_overview() to authenticated;
