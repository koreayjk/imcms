-- 이번 달만 올리는 매체 AI 한도 (운영 DB에는 이미 적용됨: ai_limit_boosts, ai_limit_of, ai_usage_status)
--   - 한 매체·한 달(한국시간 1일 기준)에 한 줄. 달이 바뀌면 저절로 원래 한도(요금제 기본 또는 ai_monthly_limit)로 돌아간다.
--   - 설정 화면의 "매체 전체 AI 사용" 줄에 "이번 달만 300 → 500회 상향"으로 표시된다 (ai_usage_status 의 boost_from·boost_to).
--   - 올릴 때: 아래 맨 끝 insert 의 매체·달·한도를 바꿔 실행한다 (같은 달에 이미 있으면 update 로 고친다).

create table if not exists public.ai_limit_boosts (
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  month date not null,
  base_limit integer not null check (base_limit >= 0),
  boost_limit integer not null check (boost_limit >= 0),
  note text,
  created_at timestamptz not null default now(),
  primary key (outlet_id, month)
);
alter table public.ai_limit_boosts enable row level security;
revoke all on public.ai_limit_boosts from anon, authenticated;

create or replace function public.ai_limit_of(o uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.boost_limit from ai_limit_boosts b where b.outlet_id = o and b.month = date_trunc('month', now() at time zone 'Asia/Seoul')::date),
    x.ai_monthly_limit,
    case x.plan when 'basic' then 300 when 'standard' then 900 when 'premium' then 2000 end)
  from outlets x where x.id = o;
$$;

create or replace function public.ai_usage_status(o uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  drafts integer;
  ov boolean;
  pl text;
  my_used integer;
  my_lim integer;
  b_from integer;
  b_to integer;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  select plan, ai_overage into pl, ov from outlets where id = o;
  lim := public.ai_limit_of(o);
  select count(*), count(*) filter (where kind = 'draft') into used, drafts
  from ai_usage where outlet_id = o and created_at >= public.kst_month_start();
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and created_at >= public.kst_month_start();
  my_lim := public.ai_member_limit_of(o, auth.uid());
  select b.base_limit, b.boost_limit into b_from, b_to from ai_limit_boosts b
  where b.outlet_id = o and b.month = date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  return jsonb_build_object('plan', pl, 'limit', lim, 'used', used, 'drafts', drafts, 'legal', used - drafts, 'overage', coalesce(ov, false),
    'over', greatest(0, used - coalesce(lim, used)), 'mine_used', my_used, 'mine_limit', my_lim,
    'boost_from', b_from, 'boost_to', b_to);
end $$;

-- 2026년 11월 뉴스폭탄: 300 → 500 (이번 달만)
insert into public.ai_limit_boosts (outlet_id, month, base_limit, boost_limit, note)
select '6353da89-bc32-4179-b49b-bfe8d0009265', date '2026-11-01', 300, 500, '이번 달만 상향 (이호현 발행인 요청)'
where not exists (select 1 from public.ai_limit_boosts where outlet_id = '6353da89-bc32-4179-b49b-bfe8d0009265' and month = date '2026-11-01');
