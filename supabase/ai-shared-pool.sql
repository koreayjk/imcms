-- 추가 매체는 청구받는 매체(본 매체)의 AI 한도를 같이 쓴다
--   (Supabase SQL 에디터에서 실행, ai-usage-all.sql · billing-auto.sql 다음. 여러 번 실행해도 된다)
--   운영팀 '자동 청구' 화면에서 "추가 매체로 청구할 매체"(bill_to)를 정한 매체가 추가 매체다
--   · 한도: 본 매체 요금제(또는 운영팀이 정한 한도)를 본 매체 + 추가 매체가 함께 쓴다
--     (추가 매체 자체의 요금제는 AI 한도에 쓰지 않는다 — 요금제를 비워 둬도 무제한이 되지 않는다)
--   · 한도를 넘긴 뒤 계속 쓰기(ai_overage)도 본 매체 설정을 따른다

-- 본 매체 (추가 매체면 청구받는 매체, 아니면 자기 자신)
create or replace function public.ai_pool_root(o uuid) returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select p.bill_to from outlet_plans p where p.outlet_id = o and p.bill_to is not null), o)
$$;

-- 한도를 함께 쓰는 매체들 (본 매체 + 그 추가 매체)
create or replace function public.ai_pool_ids(o uuid) returns setof uuid language sql stable security definer set search_path = public as $$
  select public.ai_pool_root(o)
  union
  select p.outlet_id from outlet_plans p where p.bill_to = public.ai_pool_root(o)
$$;

create or replace function public.ai_limit_of(o uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(ai_monthly_limit, case plan when 'basic' then 300 when 'standard' then 900 when 'premium' then 2000 end)
  from outlets where id = public.ai_pool_root(o);
$$;

-- 이번 달 사용 현황: 함께 쓰는 매체 전체 + 내 몫
create or replace function public.ai_usage_status(o uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  root uuid;
  lim integer;
  used integer;
  drafts integer;
  ov boolean;
  pl text;
  my_used integer;
  my_lim integer;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  root := public.ai_pool_root(o);
  select plan, ai_overage into pl, ov from outlets where id = root;
  lim := public.ai_limit_of(o);
  select count(*), count(*) filter (where kind = 'draft') into used, drafts
  from ai_usage where outlet_id in (select public.ai_pool_ids(o)) and created_at >= public.kst_month_start();
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and created_at >= public.kst_month_start();
  my_lim := public.ai_member_limit_of(o, auth.uid());
  return jsonb_build_object('plan', pl, 'limit', lim, 'used', used, 'drafts', drafts, 'legal', used - drafts, 'overage', coalesce(ov, false),
    'over', greatest(0, used - coalesce(lim, used)), 'mine_used', my_used, 'mine_limit', my_lim, 'shared', root <> o);
end $$;

-- AI 한 번 쓰기 직전에 한 건을 잡는다: 내 한도 → 함께 쓰는 매체 한도 순서
create or replace function public.ai_usage_reserve(o uuid, p_kind text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  root uuid;
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
  root := public.ai_pool_root(o);
  -- 함께 쓰는 매체끼리 동시에 잡아도 한도를 넘지 않게 본 매체 기준으로 잠근다
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || root::text));
  my_lim := public.ai_member_limit_of(o, auth.uid());
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and created_at >= public.kst_month_start();
  if my_lim is not null and my_used >= my_lim then
    return jsonb_build_object('ok', false, 'scope', 'member', 'used', my_used, 'limit', my_lim);
  end if;
  lim := public.ai_limit_of(o);
  select coalesce(ai_overage, false) into ov from outlets where id = root;
  select count(*) into used from ai_usage where outlet_id in (select public.ai_pool_ids(o)) and created_at >= public.kst_month_start();
  is_over := lim is not null and used >= lim;
  if is_over and not ov then
    return jsonb_build_object('ok', false, 'scope', 'outlet', 'used', used, 'limit', lim);
  end if;
  insert into ai_usage (outlet_id, user_id, over_limit, kind) values (o, auth.uid(), is_over, p_kind) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'used', used + 1, 'limit', lim, 'over_limit', is_over, 'mine_used', my_used + 1, 'mine_limit', my_lim);
end $$;

revoke all on function public.ai_usage_reserve(uuid, text) from public, anon;
grant execute on function public.ai_usage_reserve(uuid, text), public.ai_usage_status(uuid) to authenticated;
revoke all on function public.ai_pool_root(uuid), public.ai_pool_ids(uuid) from public, anon;
grant execute on function public.ai_pool_root(uuid), public.ai_pool_ids(uuid) to authenticated;

-- 확인: 추가 매체와 함께 쓰는 한도
select c.name as "추가 매체", r.name as "본 매체", r.plan as "본 매체 요금제", public.ai_limit_of(c.id) as "함께 쓰는 AI 한도"
from outlet_plans p join outlets c on c.id = p.outlet_id join outlets r on r.id = p.bill_to
order by r.name, c.name;
