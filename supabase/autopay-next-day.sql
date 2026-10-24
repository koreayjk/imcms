-- 자동결제 시점 변경: 청구서를 발행한 지 하루가 지나면 납부 기한 오전 10시에 결제한다 (Supabase SQL 에디터에서 1회 실행. payments.sql 다음, 여러 번 실행해도 된다)
--   예전: 발행 7일 뒤부터 결제 → 지금: 말일에 발행해 "내일 결제 예정" 안내를 보내고 매월 1일에 결제
--   (자동결제 매체의 납부 기한은 서버가 매월 1일로 정해 청구서를 만든다. 직접 발행한 청구서는 정한 납부 기한을 따른다)
drop function if exists public.autopay_due(text);
create or replace function public.autopay_due(secret text) returns table (invoice_id uuid, outlet_id uuid, customer_key text, billing_key text, provider text, amount bigint, manager_email text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query
    select i.id, i.outlet_id, k.customer_key, k.billing_key, k.provider, i.total, b.manager_email
    from invoices i
    join outlet_autopay a on a.outlet_id = i.outlet_id and a.active
    join private.billing_keys k on k.outlet_id = i.outlet_id
    left join outlet_billing b on b.outlet_id = i.outlet_id
    where i.status = 'unpaid' and i.total > 0
      and (i.due_date is null or i.due_date <= (now() at time zone 'Asia/Seoul')::date)
      -- 결제 전에 알린다: 청구서(결제 예정 안내 메일)를 발행하고 하루가 지나야 자동결제한다
      and i.created_at <= now() - interval '1 day'
      and not exists (select 1 from payments p where p.invoice_id = i.id and p.kind = 'autopay'
                      and p.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'));
end $$;
revoke all on function public.autopay_due(text) from public;
grant execute on function public.autopay_due(text) to anon, authenticated;
