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
  -- 결제 화면에 미리 적어 둘 이메일: 결제 담당자 이메일 → 없으면 그 매체(그룹)의 발행인·편집장 계정 이메일 (청구서 안내 메일을 받는 사람과 같게)
  select nullif(trim(manager_email), '') into mail from outlet_billing where outlet_id = i.outlet_id;
  if mail is null then
    select u.email::text into mail
    from outlets o
    join profiles p on p.role in ('admin', 'editor') and (p.outlet_id = o.id or (p.role = 'admin' and p.publisher_id is not null and p.publisher_id = o.publisher_id))
    join auth.users u on u.id = p.id
    where o.id = i.outlet_id and u.email is not null
      -- IM 뉴스룸 운영팀 계정은 제외 (운영팀이 그 매체로 작업 전환해 두면 profiles.outlet_id 가 그 매체가 되므로)
      and not coalesce(p.is_super, false) and not coalesce((to_jsonb(p) ->> 'is_staff')::boolean, false)
    order by (p.role = 'admin') desc, u.created_at
    limit 1;
  end if;
  return jsonb_build_object(
    'id', i.id, 'invoice_no', i.invoice_no, 'outlet_name', oname, 'month', i.month, 'items', i.items,
    'total', i.total, 'due_date', i.due_date, 'memo', i.memo, 'status', i.status, 'paid_at', i.paid_at,
    'created_at', i.created_at, 'manager_email', mail,
    'has_autopay', exists (select 1 from outlet_autopay a where a.outlet_id = i.outlet_id and a.active));
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

-- ── 첫 결제 = 자동결제 등록 (결제 전용 링크에서 동의한 경우) ──
-- 매체의 자동결제 고객 키 (없으면 만든다. autopay_customer_key 와 같은 값이지만 로그인 대신 토큰으로 확인)
create or replace function public.payment_link_autopay_key(secret text, p_token text) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare i invoices%rowtype; k text; mail text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_token is null or length(p_token) < 40 then raise exception '결제 링크가 올바르지 않습니다.'; end if;
  select * into i from invoices where pay_token = p_token;
  if i.id is null then raise exception '결제 링크가 올바르지 않습니다.'; end if;
  select customer_key into k from private.billing_keys where outlet_id = i.outlet_id;
  if k is null then
    insert into private.settings (key, value) values ('autopay_ck_' || i.outlet_id::text, 'IMN_' || replace(gen_random_uuid()::text, '-', ''))
    on conflict (key) do nothing;
    select value into k from private.settings where key = 'autopay_ck_' || i.outlet_id::text;
  end if;
  select nullif(trim(manager_email), '') into mail from outlet_billing where outlet_id = i.outlet_id;
  return jsonb_build_object('outlet_id', i.outlet_id, 'customer_key', k, 'manager_email', mail, 'outlet_name', (select name from outlets where id = i.outlet_id));
end $$;

-- 결제 전용 링크에서 자동결제에 동의한 기록 (누가·언제·어느 문구 버전: 담당자 이메일과 매체로 남긴다)
create or replace function public.payment_link_autopay_consent(secret text, p_token text, p_version text) returns void
language plpgsql security definer set search_path = public as $$
declare i invoices%rowtype; mail text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into i from invoices where pay_token = p_token;
  if i.id is null then raise exception '결제 링크가 올바르지 않습니다.'; end if;
  select nullif(trim(manager_email), '') into mail from outlet_billing where outlet_id = i.outlet_id;
  insert into consents (user_id, email, kind, version, source, outlet_id)
  values (null, coalesce(mail, '(결제 전용 링크)'), 'autopay', left(coalesce(p_version, ''), 20), 'pay_link', i.outlet_id);
end $$;

-- 결제가 끝난 뒤 그 카드를 매체의 자동결제로 저장 (autopay_save 와 같음 + 동의 시각)
drop function if exists public.payment_link_autopay_save(text, text, text, text, text, text);
drop function if exists public.payment_link_autopay_save(text, uuid, text, text, text, text);
create or replace function public.payment_link_autopay_save(secret text, p_invoice uuid, p_customer_key text, p_billing_key text, p_card_company text, p_card_number text, p_version text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare i invoices%rowtype;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into i from invoices where id = p_invoice and pay_token is not null;
  if i.id is null then raise exception '결제 링크로 낸 청구서가 아닙니다.'; end if;
  perform public.autopay_save(secret, i.outlet_id, p_customer_key, p_billing_key, p_card_company, p_card_number, null, 'stripe');
  update outlet_autopay set consent_at = now() where outlet_id = i.outlet_id;
  -- 동의 기록: 결제 화면의 안내 문구(결제하면 자동결제 카드로 저장되는 데 동의한 것으로 봄)를 보고 결제를 마친 것
  insert into consents (user_id, email, kind, version, source, outlet_id)
  values (null, coalesce((select nullif(trim(manager_email), '') from outlet_billing where outlet_id = i.outlet_id), '(결제 전용 링크)'), 'autopay', left(coalesce(p_version, ''), 20), 'pay_link', i.outlet_id);
end $$;

revoke all on function public.payment_link_autopay_key(text, text), public.payment_link_autopay_consent(text, text, text), public.payment_link_autopay_save(text, uuid, text, text, text, text, text) from public;
grant execute on function public.payment_link_autopay_key(text, text), public.payment_link_autopay_consent(text, text, text), public.payment_link_autopay_save(text, uuid, text, text, text, text, text) to anon, authenticated;

-- 청구서 메일에 보여 줄 공급받는 자 정보 (결제 정보에 적은 값, 비어 있으면 홈페이지 설정의 하단 표시 정보로 채운다)
create or replace function public.invoice_bill_to(secret text, inv uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i invoices%rowtype; b outlet_billing%rowtype; lg jsonb; nm text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into i from invoices where id = inv;
  if i.id is null then return null; end if;
  select * into b from outlet_billing where outlet_id = i.outlet_id;
  select coalesce(site -> 'legal', '{}'::jsonb), name into lg, nm from outlets where id = i.outlet_id;
  return jsonb_build_object(
    'outlet', nm,
    'company', coalesce(nullif(trim(b.company_name), ''), nullif(trim(lg ->> 'company'), '')),
    'biz_no', coalesce(nullif(trim(b.biz_no), ''), nullif(trim(lg ->> 'bizNo'), '')),
    'ceo', coalesce(nullif(trim(b.ceo_name), ''), nullif(trim(lg ->> 'ceo'), ''), nullif(trim(lg ->> 'publisher'), '')),
    'address', coalesce(nullif(trim(b.address), ''), nullif(trim(concat_ws(' ', lg ->> 'postcode', lg ->> 'address')), '')),
    'manager', coalesce(nullif(trim(b.manager_name), ''), nullif(trim(lg ->> 'ceo'), ''), nullif(trim(lg ->> 'publisher'), '')),
    'manager_email', nullif(trim(b.manager_email), ''),
    'manager_phone', coalesce(nullif(trim(b.manager_phone), ''), nullif(trim(lg ->> 'phone'), ''))
  );
end $$;
revoke all on function public.invoice_bill_to(text, uuid) from public;
grant execute on function public.invoice_bill_to(text, uuid) to anon, authenticated;
