-- 청구서 결제 전용 링크: 로그인 없이 그 청구서 한 건만 보고 결제하는 주소 (/pay/토큰) (Supabase SQL 에디터에서 1회 실행. payments.sql·legal-billing-safety.sql 다음)
--   · 청구서마다 추측할 수 없는 긴 토큰이 생기고, 안내 메일·미납 안내 메일에 이 링크가 들어갑니다 (운영팀은 청구서 화면에서 복사해 카톡으로도 보낼 수 있습니다)
--   · 이 링크로는 그 청구서의 내용 보기와 카드 결제만 됩니다. 편집국 다른 화면은 열리지 않습니다
--   · 서버 열쇠(payment_db_secret)를 가진 서버만 부릅니다. 여러 번 실행해도 됩니다

alter table invoices add column if not exists pay_token text;
create unique index if not exists invoices_pay_token_idx on invoices (pay_token) where pay_token is not null;

-- 청구서의 결제 토큰 (없으면 만든다)
create or replace function public.invoice_pay_token(secret text, inv uuid) returns text
language plpgsql security definer set search_path = public as $$
declare t text; ok boolean;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select pay_token, true into t, ok from invoices where id = inv;
  if ok is null then return null; end if;
  if t is null then
    t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update invoices set pay_token = t where id = inv;
  end if;
  return t;
end $$;

-- 토큰으로 청구서 보기 (결제 화면에 보여줄 것만)
create or replace function public.invoice_by_pay_token(secret text, p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i invoices%rowtype; oname text; mail text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_token is null or length(p_token) < 40 then return null; end if;
  select * into i from invoices where pay_token = p_token;
  if i.id is null then return null; end if;
  select name into oname from outlets where id = i.outlet_id;
  select nullif(trim(manager_email), '') into mail from outlet_billing where outlet_id = i.outlet_id;
  return jsonb_build_object(
    'id', i.id, 'invoice_no', i.invoice_no, 'outlet_name', oname, 'month', i.month, 'items', i.items,
    'total', i.total, 'due_date', i.due_date, 'memo', i.memo, 'status', i.status, 'paid_at', i.paid_at,
    'created_at', i.created_at, 'manager_email', mail);
end $$;

-- 토큰으로 결제 시작 (payment_start 와 같은데 로그인 대신 토큰·서버 열쇠로 확인)
create or replace function public.payment_start_by_token(secret text, p_token text, p_kind text default 'card', p_provider text default 'stripe') returns jsonb
language plpgsql security definer set search_path = public as $$
declare i invoices%rowtype; oname text; oid text; outlet_name text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_token is null or length(p_token) < 40 then raise exception '결제 링크가 올바르지 않습니다.'; end if;
  select * into i from invoices where pay_token = p_token;
  if i.id is null then raise exception '결제 링크가 올바르지 않습니다.'; end if;
  if i.status = 'paid' then raise exception '이미 납부한 청구서입니다.'; end if;
  if i.total <= 0 then raise exception '결제할 금액이 없습니다.'; end if;
  select name into outlet_name from outlets where id = i.outlet_id;
  oname := left(coalesce(outlet_name, '') || ' ' || to_char(i.month, 'YYYY년 FMMM월') || ' IM 뉴스룸 이용료', 100);
  oid := 'IMN-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || left(replace(gen_random_uuid()::text, '-', ''), 16);
  insert into payments (invoice_id, outlet_id, order_id, order_name, amount, kind, provider)
  values (i.id, i.outlet_id, oid, oname, i.total, case when p_kind = 'transfer' then 'transfer' else 'card' end,
    case when p_provider = 'toss' then 'toss' else 'stripe' end);
  return jsonb_build_object('orderId', oid, 'orderName', oname, 'amount', i.total, 'invoiceId', i.id);
end $$;

revoke all on function public.invoice_pay_token(text, uuid), public.invoice_by_pay_token(text, text), public.payment_start_by_token(text, text, text, text) from public;
grant execute on function public.invoice_pay_token(text, uuid), public.invoice_by_pay_token(text, text), public.payment_start_by_token(text, text, text, text) to anon, authenticated;
