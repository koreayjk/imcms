-- 청구서 온라인 결제 (토스페이먼츠) — Supabase SQL 에디터에서 실행 (support.sql·press-cron.sql 다음)
--   고객사(편집장·발행인)가 청구서에서 카드·계좌이체로 결제하거나, 카드를 등록해 두면 청구서가 나올 때 자동으로 결제된다
--   결제 승인은 우리 서버가 토스페이먼츠에 확인한 뒤에만 기록된다. 서버는 아래 “결제 기록용 비밀 열쇠”로 자신을 증명한다
--   ※ 실행 후 맨 아래 결과에 나오는 열쇠를 Vercel 환경 변수 PAYMENT_DB_SECRET 에 넣어 주세요 (채팅·메일로 보내지 마세요)

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('payment_db_secret', encode(gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

create or replace function public.payment_secret_ok(secret text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select coalesce(secret = (select value from private.settings where key = 'payment_db_secret'), false);
$$;
revoke all on function public.payment_secret_ok(text) from public, anon, authenticated;

-- ── 결제 기록 ──
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  -- 토스페이먼츠에 보내는 주문번호 (영문·숫자·-_ 6~64자)
  order_id text not null unique check (order_id ~ '^[A-Za-z0-9_-]{6,64}$'),
  order_name text not null,
  amount bigint not null check (amount > 0),
  status text not null default 'ready' check (status in ('ready', 'done', 'failed', 'canceled')),
  -- card / transfer / autopay
  kind text not null default 'card' check (kind in ('card', 'transfer', 'autopay')),
  payment_key text unique,
  method text,
  approved_at timestamptz,
  receipt_url text,
  fail_message text,
  -- 시험 키로 한 결제 (실제 돈이 오가지 않는다. 청구서는 미납 그대로 둔다)
  test_mode boolean not null default false,
  requested_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_invoice on payments(invoice_id);
alter table payments add column if not exists test_mode boolean not null default false;

alter table payments enable row level security;
drop policy if exists "payments_read" on payments;
create policy "payments_read" on payments for select to authenticated
  using (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false));
-- 쓰기는 아래 함수로만

-- 결제 시작: 청구서 금액 그대로 주문을 만든다 (금액은 화면이 아니라 청구서에서 가져온다)
create or replace function public.payment_start(inv uuid, p_kind text default 'card') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  i invoices%rowtype;
  oname text;
  oid text;
  outlet_name text;
begin
  select * into i from invoices where id = inv;
  if i.id is null then raise exception '청구서를 찾지 못했습니다.'; end if;
  if not (coalesce(public.is_outlet_editor(i.outlet_id), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 청구서를 결제할 권한이 없습니다.';
  end if;
  if i.status = 'paid' then raise exception '이미 납부한 청구서입니다.'; end if;
  if i.total <= 0 then raise exception '결제할 금액이 없습니다.'; end if;
  select name into outlet_name from outlets where id = i.outlet_id;
  oname := left(coalesce(outlet_name, '') || ' ' || to_char(i.month, 'YYYY년 FMMM월') || ' IM 뉴스룸 이용료', 100);
  oid := 'IMN-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || encode(gen_random_bytes(8), 'hex');
  insert into payments (invoice_id, outlet_id, order_id, order_name, amount, kind)
  values (i.id, i.outlet_id, oid, oname, i.total, case when p_kind = 'transfer' then 'transfer' else 'card' end);
  return jsonb_build_object('orderId', oid, 'orderName', oname, 'amount', i.total);
end $$;
revoke all on function public.payment_start(uuid, text) from public, anon;
grant execute on function public.payment_start(uuid, text) to authenticated;

-- 결제 승인 기록 (서버가 토스페이먼츠 승인 확인 후에만 부른다). 금액이 주문과 다르면 거절
--   p_test: 시험 키로 한 결제면 결제 기록만 남기고 청구서는 미납 그대로 둔다
drop function if exists public.payment_record(text, text, text, bigint, text, text, timestamptz, text, text);
create or replace function public.payment_record(secret text, p_order_id text, p_payment_key text, p_amount bigint, p_status text,
  p_method text, p_approved_at timestamptz, p_receipt_url text, p_message text, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p payments%rowtype;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into p from payments where order_id = p_order_id for update;
  if p.id is null then raise exception '주문을 찾지 못했습니다.'; end if;
  if p_status = 'done' and p_amount <> p.amount then raise exception '결제 금액이 청구 금액과 다릅니다.'; end if;
  update payments set
    status = case when p_status in ('done', 'failed', 'canceled') then p_status else status end,
    payment_key = coalesce(p_payment_key, payment_key),
    method = coalesce(p_method, method),
    approved_at = coalesce(p_approved_at, approved_at),
    receipt_url = coalesce(p_receipt_url, receipt_url),
    fail_message = case when p_status = 'failed' then left(p_message, 300) else fail_message end,
    test_mode = coalesce(p_test, false),
    updated_at = now()
  where id = p.id;
  if coalesce(p_test, false) then
    null; -- 시험 결제는 청구서 상태를 바꾸지 않는다
  elsif p_status = 'done' then
    update invoices set status = 'paid', paid_at = coalesce(p_approved_at, now()) where id = p.invoice_id;
  elsif p_status = 'canceled' then
    -- 취소되면, 같은 청구서에 다른 완료 결제가 없을 때 미납으로 되돌린다
    if not exists (select 1 from payments where invoice_id = p.invoice_id and status = 'done' and id <> p.id) then
      update invoices set status = 'unpaid', paid_at = null where id = p.invoice_id;
    end if;
  end if;
  return jsonb_build_object('invoiceId', p.invoice_id, 'amount', p.amount);
end $$;
revoke all on function public.payment_record(text, text, text, bigint, text, text, timestamptz, text, text, boolean) from public;
grant execute on function public.payment_record(text, text, text, bigint, text, text, timestamptz, text, text, boolean) to anon, authenticated;

-- 서버(환불·웹훅): 결제 정보 (주문번호로)
create or replace function public.payment_lookup(secret text, p_payment_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('orderId', order_id, 'paymentKey', payment_key, 'amount', amount, 'status', status, 'testMode', test_mode)
  from payments where id = p_payment_id and public.payment_secret_ok(secret);
$$;
revoke all on function public.payment_lookup(text, uuid) from public;
grant execute on function public.payment_lookup(text, uuid) to anon, authenticated;

-- 주문 확인 (결제 완료 화면에서 금액 대조용). 그 매체 편집장·발행인·운영팀만
create or replace function public.payment_order(p_order_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('orderId', order_id, 'amount', amount, 'status', status, 'invoiceId', invoice_id, 'orderName', order_name)
  from payments
  where order_id = p_order_id and (coalesce(public.is_outlet_editor(outlet_id), false) or coalesce(public.is_staff(), false));
$$;
revoke all on function public.payment_order(text) from public, anon;
grant execute on function public.payment_order(text) to authenticated;

-- ── 자동결제 (카드 등록) ──
-- 화면에 보여줄 정보만 (카드사·끝 번호). 결제에 쓰는 빌링키는 아래 private 표에만 둔다
create table if not exists outlet_autopay (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  card_company text,
  card_number text, -- 가려진 번호 (예: 4330****1234***)
  active boolean not null default true,
  registered_by uuid references profiles(id) on delete set null,
  registered_at timestamptz not null default now(),
  last_error text
);
alter table outlet_autopay enable row level security;
drop policy if exists "autopay_read" on outlet_autopay;
create policy "autopay_read" on outlet_autopay for select to authenticated
  using (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false));

create table if not exists private.billing_keys (
  outlet_id uuid primary key references public.outlets(id) on delete cascade,
  customer_key text not null,
  billing_key text not null,
  updated_at timestamptz not null default now()
);

-- 카드 등록 화면에서 쓰는 고객 키 (매체마다 하나, 추측할 수 없는 값). 편집장·발행인만
create or replace function public.autopay_customer_key(o uuid) returns text
language plpgsql security definer set search_path = public, private as $$
declare k text;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then raise exception '카드를 등록할 권한이 없습니다.'; end if;
  select customer_key into k from private.billing_keys where outlet_id = o;
  if k is null then
    insert into private.settings (key, value) values ('autopay_ck_' || o::text, 'IMN_' || encode(gen_random_bytes(16), 'hex'))
    on conflict (key) do nothing;
    select value into k from private.settings where key = 'autopay_ck_' || o::text;
  end if;
  return k;
end $$;
revoke all on function public.autopay_customer_key(uuid) from public, anon;
grant execute on function public.autopay_customer_key(uuid) to authenticated;

-- 서버: 빌링키 저장 (토스페이먼츠에서 발급받은 뒤). 고객 키가 그 매체 것과 같아야 한다
create or replace function public.autopay_save(secret text, o uuid, p_customer_key text, p_billing_key text, p_card_company text, p_card_number text, p_user uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_customer_key is distinct from coalesce((select customer_key from private.billing_keys where outlet_id = o),
       (select value from private.settings where key = 'autopay_ck_' || o::text)) then
    raise exception '고객 키가 맞지 않습니다.';
  end if;
  insert into private.billing_keys (outlet_id, customer_key, billing_key, updated_at) values (o, p_customer_key, p_billing_key, now())
  on conflict (outlet_id) do update set billing_key = excluded.billing_key, customer_key = excluded.customer_key, updated_at = now();
  insert into outlet_autopay (outlet_id, card_company, card_number, active, registered_by, registered_at, last_error)
  values (o, left(p_card_company, 40), left(p_card_number, 40), true, p_user, now(), null)
  on conflict (outlet_id) do update set card_company = excluded.card_company, card_number = excluded.card_number, active = true,
    registered_by = excluded.registered_by, registered_at = now(), last_error = null;
end $$;
revoke all on function public.autopay_save(text, uuid, text, text, text, text, uuid) from public;
grant execute on function public.autopay_save(text, uuid, text, text, text, text, uuid) to anon, authenticated;

-- 자동결제 해지 (편집장·발행인·운영팀). 빌링키도 지운다
create or replace function public.autopay_remove(o uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then raise exception '권한이 없습니다.'; end if;
  delete from private.billing_keys where outlet_id = o;
  delete from outlet_autopay where outlet_id = o;
end $$;
revoke all on function public.autopay_remove(uuid) from public, anon;
grant execute on function public.autopay_remove(uuid) to authenticated;

-- 서버(예약 작업): 자동결제할 청구서 목록 — 미납, 납부 기한이 오늘(한국)까지, 자동결제 켜짐, 오늘 아직 시도 안 함
create or replace function public.autopay_due(secret text) returns table (invoice_id uuid, outlet_id uuid, customer_key text, billing_key text, amount bigint, manager_email text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  return query
    select i.id, i.outlet_id, k.customer_key, k.billing_key, i.total, b.manager_email
    from invoices i
    join outlet_autopay a on a.outlet_id = i.outlet_id and a.active
    join private.billing_keys k on k.outlet_id = i.outlet_id
    left join outlet_billing b on b.outlet_id = i.outlet_id
    where i.status = 'unpaid' and i.total > 0
      and (i.due_date is null or i.due_date <= (now() at time zone 'Asia/Seoul')::date)
      and not exists (select 1 from payments p where p.invoice_id = i.id and p.kind = 'autopay'
                      and p.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'));
end $$;
revoke all on function public.autopay_due(text) from public;
grant execute on function public.autopay_due(text) to anon, authenticated;

-- 서버: 자동결제 주문 만들기
create or replace function public.autopay_start(secret text, inv uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  i invoices%rowtype;
  oname text;
  oid text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into i from invoices where id = inv and status = 'unpaid';
  if i.id is null then raise exception '결제할 청구서가 없습니다.'; end if;
  oname := left(coalesce((select name from outlets where id = i.outlet_id), '') || ' ' || to_char(i.month, 'YYYY년 FMMM월') || ' IM 뉴스룸 이용료', 100);
  oid := 'IMA-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || encode(gen_random_bytes(8), 'hex');
  insert into payments (invoice_id, outlet_id, order_id, order_name, amount, kind, requested_by)
  values (i.id, i.outlet_id, oid, oname, i.total, 'autopay', null);
  return jsonb_build_object('orderId', oid, 'orderName', oname, 'amount', i.total);
end $$;
revoke all on function public.autopay_start(text, uuid) from public;
grant execute on function public.autopay_start(text, uuid) to anon, authenticated;

-- 서버: 자동결제 실패 사유를 남긴다 (화면에 “카드를 확인해 주세요” 안내)
create or replace function public.autopay_error(secret text, o uuid, msg text) returns void
language sql security definer set search_path = public as $$
  update outlet_autopay set last_error = left(msg, 300) where outlet_id = o and public.payment_secret_ok(secret);
$$;
revoke all on function public.autopay_error(text, uuid, text) from public;
grant execute on function public.autopay_error(text, uuid, text) to anon, authenticated;

-- 매일 오전 10시(한국) 자동결제: 납부 기한이 된 미납 청구서를 등록된 카드·계좌로 결제 (press-cron.sql의 예약 작업 열쇠를 쓴다)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from private.settings where key = 'press_cron_secret') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'autopay-charge';
    perform cron.schedule('autopay-charge', '0 1 * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/autopay',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 60000
      );
    $job$);
  end if;
end $$;

-- 결과: 이 열쇠를 Vercel 환경 변수 PAYMENT_DB_SECRET 에 넣으세요
select value as "Vercel PAYMENT_DB_SECRET 에 넣을 값" from private.settings where key = 'payment_db_secret';
