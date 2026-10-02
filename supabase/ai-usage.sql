-- 매체별 요금제와 AI 기사 초안 사용량 (Supabase SQL 에디터에서 실행, staff.sql·outlet-members.sql 다음)
--   요금제마다 한 달(한국 시간 1일~말일) AI 초안 한도가 있다: 베이직 100 · 스탠다드 300 · 프리미엄 1,000 · 엔터프라이즈 맞춤
--   요금제를 정하지 않은 매체(운영사 자체 매체 등)는 한도 없이 쓴다
--   한도를 다 쓰면: “추가 사용”을 켠 매체는 계속 쓰고 추가분을 청구, 아니면 다음 달 1일까지 AI 초안을 막는다
--   요금제·한도는 IM 뉴스룸 운영팀(총관리자·매니저)만 바꾼다 (outlets 수정 권한이 운영팀뿐)

alter table outlets add column if not exists plan text
  check (plan is null or plan in ('basic', 'standard', 'premium', 'enterprise'));
-- 요금제 기본 한도 대신 따로 정한 한도 (엔터프라이즈·이벤트 등). 비우면 요금제 기본값
alter table outlets add column if not exists ai_monthly_limit integer check (ai_monthly_limit is null or ai_monthly_limit >= 0);
-- 한도를 넘어도 계속 쓸지 (넘은 만큼 100건마다 추가 요금)
alter table outlets add column if not exists ai_overage boolean not null default false;

create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  outlet_id uuid not null references outlets(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 5),
  -- 한도를 넘어 추가 요금 대상인 건
  over_limit boolean not null default false,
  -- AI가 다 쓰면 true. 실패하면 행을 지운다 (한도에서 빠진다)
  done boolean not null default false
);
create index if not exists ai_usage_outlet_month on ai_usage(outlet_id, created_at);

alter table ai_usage enable row level security;
-- 보기: 그 매체를 볼 수 있는 사람(같은 그룹·소속)과 운영팀. 쓰기는 아래 함수로만
drop policy if exists "ai_usage_read" on ai_usage;
create policy "ai_usage_read" on ai_usage for select to authenticated using (public.can_view_outlet(outlet_id));

-- 이번 달(한국 시간) 시작 시각
create or replace function public.kst_month_start() returns timestamptz language sql stable as $$
  select (date_trunc('month', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
$$;

-- 매체의 이번 달 한도 (null = 한도 없음)
create or replace function public.ai_limit_of(o uuid) returns integer language sql stable security definer set search_path = public as $$
  select coalesce(ai_monthly_limit, case plan when 'basic' then 100 when 'standard' then 300 when 'premium' then 1000 end)
  from outlets where id = o;
$$;

-- 이번 달 사용 현황: { plan, limit, used, overage, over } — 그 매체를 볼 수 있는 사람만
create or replace function public.ai_usage_status(o uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  ov boolean;
  pl text;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  select plan, ai_overage into pl, ov from outlets where id = o;
  lim := public.ai_limit_of(o);
  select count(*) into used from ai_usage where outlet_id = o and created_at >= public.kst_month_start();
  return jsonb_build_object('plan', pl, 'limit', lim, 'used', used, 'overage', coalesce(ov, false),
    'over', greatest(0, used - coalesce(lim, used)));
end $$;

-- AI 초안을 쓰기 직전에 한 건을 잡는다. 한도를 다 썼고 추가 사용이 꺼져 있으면 잡지 않는다
--   돌려주는 값: { ok, id, used, limit, over_limit }
create or replace function public.ai_usage_reserve(o uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  ov boolean;
  new_id bigint;
  is_over boolean;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not coalesce(public.can_view_outlet(o), false) then raise exception '이 매체에서 AI 초안을 쓸 권한이 없습니다.'; end if;
  -- 같은 매체에서 동시에 눌러도 한도를 넘지 않게 차례대로
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || o::text));
  lim := public.ai_limit_of(o);
  select coalesce(ai_overage, false) into ov from outlets where id = o;
  select count(*) into used from ai_usage where outlet_id = o and created_at >= public.kst_month_start();
  is_over := lim is not null and used >= lim;
  if is_over and not ov then
    return jsonb_build_object('ok', false, 'used', used, 'limit', lim);
  end if;
  insert into ai_usage (outlet_id, user_id, over_limit) values (o, auth.uid(), is_over) returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'used', used + 1, 'limit', lim, 'over_limit', is_over);
end $$;

-- 다 쓴 뒤 모델·토큰·비용을 적는다 (본인이 잡은 건만)
create or replace function public.ai_usage_finish(rid bigint, m text, tin integer, tout integer, cost numeric) returns void
language sql security definer set search_path = public as $$
  update ai_usage set model = left(m, 60), input_tokens = tin, output_tokens = tout, cost_usd = cost, done = true
  where id = rid and user_id = auth.uid() and not done;
$$;

-- AI가 실패하면 잡았던 건을 돌려준다 (본인이 30분 안에 잡은 아직 안 끝난 건만)
create or replace function public.ai_usage_release(rid bigint) returns void
language sql security definer set search_path = public as $$
  delete from ai_usage where id = rid and user_id = auth.uid() and not done and created_at > now() - interval '30 minutes';
$$;

revoke all on function public.ai_usage_status(uuid), public.ai_usage_reserve(uuid), public.ai_usage_finish(bigint, text, integer, integer, numeric),
  public.ai_usage_release(bigint), public.ai_limit_of(uuid) from public, anon;
grant execute on function public.ai_usage_status(uuid), public.ai_usage_reserve(uuid), public.ai_usage_finish(bigint, text, integer, integer, numeric),
  public.ai_usage_release(bigint), public.ai_limit_of(uuid), public.kst_month_start() to authenticated;

-- 운영팀: 모든 매체의 이번 달 사용 현황 (요금제·한도·사용·추가분)
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
revoke all on function public.ai_usage_overview() from public, anon;
grant execute on function public.ai_usage_overview() to authenticated;
