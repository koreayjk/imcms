-- 매월 자동 청구서 (Supabase SQL 에디터에서 실행, payments.sql 다음. 여러 번 실행해도 된다)
--   매일 0시 30분(한국)에 IM 뉴스룸 서버를 불러, 자동 청구를 켠 매체의 '이번 달 청구서'가 없으면 만든다
--   → 사실상 매월 1일에 발행되고, 납부 기한은 그달 10일 (자동결제를 등록한 매체는 10일 오전 10시에 결제)
--   청구 항목(요금제 이용료·베타 반값·1년 결제·추가 매체·지난달 AI 추가 사용·세팅비)은 서버가 요금표로 계산한다
--   같은 매체·같은 달 청구서가 이미 있으면(직접 발행한 것 포함) 건드리지 않는다

-- 1) 매체별 자동 청구 설정 (운영팀만 보고 고친다)
create table if not exists outlet_plans (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  auto boolean not null default false,                      -- 자동 청구 켜기
  cycle text not null default 'monthly' check (cycle in ('monthly', 'annual')),  -- 월 결제 / 1년 결제(11개월 값)
  beta boolean not null default false,                      -- 베타 테스트 반값
  start_month date,                                         -- 첫 청구 월 (그달 1일). 1년 결제는 이 달부터 12개월마다
  bill_to uuid references outlets(id) on delete set null,   -- 추가 매체: 이 매체 청구서에 '추가 매체'로 붙인다
  setup_fee_pending boolean not null default false,         -- 다음 청구서에 세팅비를 한 번 넣는다
  custom_monthly bigint check (custom_monthly is null or custom_monthly >= 0),  -- 요금제 대신 쓸 월 금액(VAT 포함)
  updated_at timestamptz not null default now(),
  check (bill_to is null or bill_to <> outlet_id)
);
alter table outlet_plans enable row level security;
drop policy if exists "outlet_plans_staff" on outlet_plans;
create policy "outlet_plans_staff" on outlet_plans for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 2) 청구할 매체 목록 (서버 열쇠로만). p_month = 청구 월 1일
--    추가 매체(bill_to)는 따로 청구서를 만들지 않고, 청구받을 매체의 children 으로 함께 넘긴다
create or replace function public.billing_targets(secret text, p_month date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m date := date_trunc('month', p_month)::date;
  prev_from timestamptz := ((m - interval '1 month')::timestamp at time zone 'Asia/Seoul');
  prev_to timestamptz := (m::timestamp at time zone 'Asia/Seoul');
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'outlet_id', o.id, 'name', o.name, 'plan', o.plan,
      'cycle', p.cycle, 'beta', p.beta, 'start_month', p.start_month,
      'setup_fee_pending', p.setup_fee_pending, 'custom_monthly', p.custom_monthly,
      'has_invoice', exists (select 1 from invoices i where i.outlet_id = o.id and i.month = m),
      'over_count', (select count(*) from ai_usage u where u.outlet_id = o.id and u.over_limit and u.created_at >= prev_from and u.created_at < prev_to),
      'autopay', (select jsonb_build_object('card_company', a.card_company, 'card_number', a.card_number) from outlet_autopay a where a.outlet_id = o.id and a.active),
      'children', coalesce((
        select jsonb_agg(jsonb_build_object(
          'outlet_id', c.id, 'name', c.name,
          'over_count', (select count(*) from ai_usage u where u.outlet_id = c.id and u.over_limit and u.created_at >= prev_from and u.created_at < prev_to)
        ) order by c.name)
        from outlet_plans cp join outlets c on c.id = cp.outlet_id
        where cp.bill_to = o.id and cp.auto and (cp.start_month is null or cp.start_month <= m)
      ), '[]'::jsonb)
    ) order by o.name)
    from outlet_plans p join outlets o on o.id = p.outlet_id
    where p.auto and p.bill_to is null and (p.start_month is null or p.start_month <= m)
  ), '[]'::jsonb);
end $$;

-- 3) 청구서 만들기 (서버 열쇠로만). 같은 달 청구서가 있으면 아무것도 하지 않고 null
create or replace function public.billing_create(secret text, o uuid, p_month date, p_items jsonb, p_supply bigint, p_vat bigint, p_total bigint,
  p_due date, p_memo text, p_clear_setup boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_total <= 0 then return null; end if;
  insert into invoices (outlet_id, month, items, supply_amount, vat, total, due_date, memo)
  values (o, date_trunc('month', p_month)::date, p_items, p_supply, p_vat, p_total, p_due, p_memo)
  on conflict (outlet_id, month) do nothing
  returning id into new_id;
  if new_id is not null and p_clear_setup then
    update outlet_plans set setup_fee_pending = false, updated_at = now() where outlet_id = o;
  end if;
  return new_id;
end $$;

revoke all on function public.billing_targets(text, date), public.billing_create(text, uuid, date, jsonb, bigint, bigint, bigint, date, text, boolean) from public;
grant execute on function public.billing_targets(text, date), public.billing_create(text, uuid, date, jsonb, bigint, bigint, bigint, date, text, boolean) to anon, authenticated;

-- 4) 매일 0시 30분(한국 = 15:30 UTC)에 자동 청구 (press-cron.sql 의 예약 작업 열쇠를 쓴다)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from private.settings where key = 'press_cron_secret') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'billing-monthly';
    perform cron.schedule('billing-monthly', '30 15 * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/billing',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 60000
      );
    $job$);
  else
    raise notice '예약 작업(pg_cron) 또는 press-cron.sql 열쇠가 없어 자동 실행은 켜지 않았습니다. 운영팀 화면의 "이번 달 청구서 지금 만들기"로 만들 수 있습니다.';
  end if;
end $$;
