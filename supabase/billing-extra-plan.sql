-- 추가 매체 요금제(사양) 선택: 청구할 매체 목록에 추가 매체의 요금제를 함께 넘긴다 (Supabase SQL 에디터에서 1회 실행. billing-auto.sql 다음. 여러 번 실행해도 된다)
--   추가 매체 금액: 베이직 90,000 · 스탠다드 110,000 · 프리미엄 150,000 (월). 이 함수만 바꾸므로 다른 설정은 그대로입니다.
--   실행 전에는 추가 매체가 모두 베이직 금액(90,000원)으로 청구됩니다

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
          'outlet_id', c.id, 'name', c.name, 'plan', c.plan,
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

