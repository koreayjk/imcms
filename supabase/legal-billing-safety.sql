-- 계약·결제 안전장치 (Supabase SQL 에디터에서 실행. payments.sql·billing-auto.sql·service-apply.sql·staff.sql 다음. 여러 번 실행해도 된다)
--   1) 약관·개인정보 동의 기록 (가입할 때 서버 시각으로 남긴다)
--   2) 계약한 고객의 신청서(약관 동의 기록)는 1년 자동 정리에서 빼기
--   3) 청구서 번호
--   4) 납부된 청구서는 금액을 못 고치게, 금액을 바꾸면 진행 중인 결제 주문은 무효
--   5) 결제 기록: 청구서 금액과 다르거나 이미 낸 청구서면 '확인 필요'로 남기고 청구서는 그대로, 완료된 결제가 실패로 바뀌지 않게
--   6) 누가 결제 화면을 열어 둔 청구서는 자동결제를 미룬다 (이중 결제 방지)

-- ── 1) 동의 기록 ──
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  -- 계정을 지워도 동의 기록은 계약 기록으로 5년 보관한다 (전자상거래법)
  user_id uuid references auth.users(id) on delete set null,
  email text,
  kind text not null check (kind in ('terms', 'privacy')),
  version text not null,
  -- signup(이메일 가입) / google(구글 가입) / trial(무료 체험)
  source text not null default 'signup',
  agreed_at timestamptz not null default now()
);
create index if not exists consents_user on consents(user_id);
alter table consents enable row level security;
drop policy if exists "consents_read" on consents;
create policy "consents_read" on consents for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_staff(), false));
-- 쓰기는 아래 함수·트리거로만

-- 이메일 가입: 가입 화면이 보낸 동의 버전을 가입 순간(서버 시각)에 기록
create or replace function public.consents_from_signup() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  begin
    if coalesce(m->>'terms_version', '') <> '' then
      insert into consents (user_id, email, kind, version, source) values (new.id, new.email, 'terms', left(m->>'terms_version', 20), left(coalesce(nullif(m->>'consent_source', ''), 'signup'), 20));
    end if;
    if coalesce(m->>'privacy_version', '') <> '' then
      insert into consents (user_id, email, kind, version, source) values (new.id, new.email, 'privacy', left(m->>'privacy_version', 20), left(coalesce(nullif(m->>'consent_source', ''), 'signup'), 20));
    end if;
  exception when others then
    raise warning 'consent record % failed: %', new.id, sqlerrm;
  end;
  return new;
end $$;
drop trigger if exists zz_consents_signup on auth.users;
create trigger zz_consents_signup after insert on auth.users for each row execute function public.consents_from_signup();

-- 구글 가입: 로그인 직후 서버(/auth/callback)가 부른다. 같은 버전 동의가 이미 있으면 다시 쓰지 않는다
create or replace function public.record_consent(p_terms text, p_privacy text, p_source text default 'google') returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); e text;
begin
  if u is null then raise exception '로그인이 필요합니다.'; end if;
  select email into e from auth.users where id = u;
  if coalesce(p_terms, '') <> '' and not exists (select 1 from consents where user_id = u and kind = 'terms' and version = p_terms) then
    insert into consents (user_id, email, kind, version, source) values (u, e, 'terms', left(p_terms, 20), left(coalesce(p_source, 'google'), 20));
  end if;
  if coalesce(p_privacy, '') <> '' and not exists (select 1 from consents where user_id = u and kind = 'privacy' and version = p_privacy) then
    insert into consents (user_id, email, kind, version, source) values (u, e, 'privacy', left(p_privacy, 20), left(coalesce(p_source, 'google'), 20));
  end if;
end $$;
revoke all on function public.record_consent(text, text, text) from public, anon;
grant execute on function public.record_consent(text, text, text) to authenticated;

-- 신청서: 개인정보 수집·이용 동의 버전
alter table beta_requests add column if not exists privacy_version text;

-- ── 2) 신청서 1년 정리: 계약한 고객(그룹을 만든 신청서)은 지우지 않는다 ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('beta-requests-cleanup', '30 19 * * *',
      $job$ delete from public.beta_requests where created_at < now() - interval '1 year' and publisher_id is null and coalesce(status, '') <> 'done' $job$);
  end if;
end $$;

-- ── 3) 청구서 번호 (IMN-2026-00001) ──
create sequence if not exists invoice_no_seq;
alter table invoices add column if not exists invoice_no text;
create unique index if not exists invoices_invoice_no on invoices(invoice_no);
create or replace function public.invoice_set_no() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.invoice_no is null then
    new.invoice_no := 'IMN-' || to_char(coalesce(new.created_at, now()) at time zone 'Asia/Seoul', 'YYYY') || '-' || lpad(nextval('invoice_no_seq')::text, 5, '0');
  end if;
  return new;
end $$;
drop trigger if exists invoice_set_no on invoices;
create trigger invoice_set_no before insert on invoices for each row execute function public.invoice_set_no();
-- 이미 있는 청구서에도 발행 순서대로 번호를 붙인다
update invoices i set invoice_no = 'IMN-' || to_char(i.created_at at time zone 'Asia/Seoul', 'YYYY') || '-' || lpad(nextval('invoice_no_seq')::text, 5, '0')
from (select id from invoices where invoice_no is null order by created_at) x
where i.id = x.id and i.invoice_no is null;

-- ── 4) 청구서 금액 잠금 ──
create or replace function public.invoice_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare changed boolean;
begin
  changed := new.items is distinct from old.items or new.total is distinct from old.total
          or new.supply_amount is distinct from old.supply_amount or new.vat is distinct from old.vat
          or new.month is distinct from old.month or new.outlet_id is distinct from old.outlet_id;
  if not changed then return new; end if;
  if old.status = 'paid' or exists (select 1 from payments where invoice_id = old.id and status = 'done') then
    raise exception '납부된 청구서는 금액·항목을 고칠 수 없습니다. 환불한 뒤 새 청구서를 만들어 주세요.';
  end if;
  -- 진행 중이던 결제 주문은 옛 금액이라 무효로 (고객은 새 금액으로 다시 결제)
  update payments set status = 'failed', fail_message = '청구서 금액이 바뀌어 다시 결제해야 합니다.', updated_at = now()
  where invoice_id = old.id and status = 'ready';
  return new;
end $$;
drop trigger if exists invoice_guard on invoices;
create trigger invoice_guard before update on invoices for each row execute function public.invoice_guard();

-- ── 5) 결제 기록 (payments.sql 의 같은 함수를 바꾼다) ──
alter table payments add column if not exists needs_review boolean not null default false;
create or replace function public.payment_record(secret text, p_order_id text, p_payment_key text, p_amount bigint, p_status text,
  p_method text, p_approved_at timestamptz, p_receipt_url text, p_message text, p_test boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p payments%rowtype;
  i invoices%rowtype;
  review text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into p from payments where order_id = p_order_id for update;
  if p.id is null then raise exception '주문을 찾지 못했습니다.'; end if;
  if p_status = 'done' and p_amount <> p.amount then raise exception '결제 금액이 주문 금액과 다릅니다.'; end if;
  -- 상태는 앞으로만: 완료·취소된 결제가 실패로, 취소된 결제가 다시 완료로 바뀌지 않는다
  if p.status = 'done' and p_status not in ('done', 'canceled') then return jsonb_build_object('invoiceId', p.invoice_id, 'amount', p.amount, 'ignored', true); end if;
  if p.status = 'canceled' then return jsonb_build_object('invoiceId', p.invoice_id, 'amount', p.amount, 'ignored', true); end if;

  select * into i from invoices where id = p.invoice_id for update;
  if p_status = 'done' and not coalesce(p_test, false) then
    -- 확인 필요로 남은 결제(금액이 달랐던 것)는 '이미 낸 것'으로 치지 않는다
    if exists (select 1 from payments where invoice_id = p.invoice_id and status = 'done' and id <> p.id and not test_mode and not needs_review) then
      review := '같은 청구서가 이미 결제되어 중복 결제입니다. 환불해 주세요.';
    elsif p.amount <> i.total then
      review := '청구서 금액(' || i.total || '원)과 결제 금액(' || p.amount || '원)이 다릅니다. 확인해 주세요.';
    end if;
  end if;

  update payments set
    status = case when p_status in ('done', 'failed', 'canceled') then p_status else status end,
    payment_key = coalesce(p_payment_key, payment_key),
    method = coalesce(p_method, method),
    approved_at = coalesce(p_approved_at, approved_at),
    receipt_url = coalesce(p_receipt_url, receipt_url),
    fail_message = case when p_status = 'failed' then left(p_message, 300) when review is not null then review else fail_message end,
    needs_review = review is not null,
    test_mode = coalesce(p_test, false),
    updated_at = now()
  where id = p.id;

  if coalesce(p_test, false) then
    null; -- 시험 결제는 청구서 상태를 바꾸지 않는다
  elsif p_status = 'done' and review is null then
    update invoices set status = 'paid', paid_at = coalesce(p_approved_at, now()) where id = p.invoice_id;
  elsif p_status = 'canceled' then
    if not exists (select 1 from payments where invoice_id = p.invoice_id and status = 'done' and id <> p.id and not needs_review) then
      update invoices set status = 'unpaid', paid_at = null where id = p.invoice_id;
    end if;
  end if;
  return jsonb_build_object('invoiceId', p.invoice_id, 'amount', p.amount, 'needsReview', review is not null);
end $$;
revoke all on function public.payment_record(text, text, text, bigint, text, text, timestamptz, text, text, boolean) from public;
grant execute on function public.payment_record(text, text, text, bigint, text, text, timestamptz, text, text, boolean) to anon, authenticated;

-- ── 6) 자동결제 대상: 최근 1시간 안에 누가 결제 화면을 연 청구서는 빼고, 이미 완료 결제가 있는 청구서도 뺀다 ──
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
      -- 한국 정기결제 규칙: 결제 7일 전에 알린다 → 청구서를 발행하고 7일이 지나야 자동결제한다
      and i.created_at <= now() - interval '7 days'
      and not exists (select 1 from payments p where p.invoice_id = i.id and p.kind = 'autopay'
                      and p.created_at >= (date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'))
      and not exists (select 1 from payments p where p.invoice_id = i.id and p.status = 'ready' and p.created_at > now() - interval '1 hour')
      and not exists (select 1 from payments p where p.invoice_id = i.id and p.status = 'done' and not p.test_mode);
end $$;
revoke all on function public.autopay_due(text) from public;
grant execute on function public.autopay_due(text) to anon, authenticated;

select '계약·결제 안전장치 설치 완료' as "결과";
