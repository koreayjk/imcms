-- 추가 매체는 베이직 사양 (Supabase SQL 에디터에서 실행, ai-usage-all.sql · billing-auto.sql 다음. 여러 번 실행해도 된다)
--   매체 추가는 프리미엄 전용이고, 추가 매체(운영팀 '자동 청구'에서 '청구 받을 매체'를 정한 매체)는 베이직 사양으로 운영한다
--   · AI 한도: 매체마다 따로 (추가 매체는 베이직 월 300회) — 본 매체의 프리미엄 한도를 같이 쓰지 않는다
--   · 뉴스레터 회당 2,000명 등 다른 한도도 베이직
--   · 운영팀이 자동 청구 화면에서 추가 매체로 저장하면 그 매체 요금제가 자동으로 베이직이 된다 (이 파일은 이미 연결된 매체를 맞춘다)
--   ai-shared-pool.sql(본 매체 한도 함께 쓰기)을 실행했다면 이 파일이 원래대로(매체마다 따로) 되돌린다

drop function if exists public.ai_pool_ids(uuid);

create or replace function public.ai_limit_of(o uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(ai_monthly_limit, case plan when 'basic' then 300 when 'standard' then 900 when 'premium' then 2000 end)
  from outlets where id = o;
$$;

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

drop function if exists public.ai_pool_root(uuid);

grant execute on function public.ai_usage_reserve(uuid, text), public.ai_usage_status(uuid) to authenticated;

-- 이미 추가 매체로 연결된 매체는 베이직으로
update outlets o set plan = 'basic'
 where o.id in (select p.outlet_id from outlet_plans p where p.bill_to is not null)
   and o.plan is distinct from 'basic';

-- 확인: 추가 매체와 사양
select c.name as "추가 매체", r.name as "청구 받는 매체", r.plan as "청구 매체 요금제", c.plan as "추가 매체 요금제", public.ai_limit_of(c.id) as "추가 매체 AI 한도"
from outlet_plans p join outlets c on c.id = p.outlet_id join outlets r on r.id = p.bill_to
order by r.name, c.name;
