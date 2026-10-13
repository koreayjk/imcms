-- 계약·결제 안전장치 2 (Supabase SQL 에디터에서 실행. legal-billing-safety.sql 다음. 여러 번 실행해도 된다)
--   1) 신청서는 IM 뉴스룸 서버를 거쳐서만 저장 (공개 키로 바로 넣지 못하게)
--   2) 부분 환불 기록 (환불은 총관리자만, 화면에서 막는다)
--   3) 자동결제 정기결제 동의·해지 기록
--   4) 결제 완료·환불 안내 메일 받는 사람
--   5) 해지 처리: 자동 청구·자동결제 멈춤, 30일 뒤 자료 지우기 (총관리자)
--   6) 매체를 지워도 청구서·결제 기록은 남긴다 (전자상거래법 5년)

-- ── 1) 신청서 저장 함수 ──
drop policy if exists "beta_requests_insert" on beta_requests;
create or replace function public.apply_submit(secret text, p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; e text := lower(left(coalesce(p->>'email', ''), 120));
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  -- 같은 이메일로 10분에 3건 넘게 들어오면 저장하지 않는다 (같은 신청 여러 번 누름·자동 입력)
  if (select count(*) from beta_requests where lower(email) = e and created_at > now() - interval '10 minutes') >= 3 then return null; end if;
  insert into beta_requests (company, contact_name, phone, email, outlet_count, current_cms, agreed_at, message,
    plan, billing, domain, terms_agreed_at, terms_version, privacy_version, quoted_total, beta_discount)
  values (left(p->>'company', 80), left(p->>'contact_name', 40), left(p->>'phone', 30), e, nullif(left(p->>'outlet_count', 20), ''),
    nullif(left(p->>'current_cms', 80), ''), now(), nullif(left(p->>'message', 2000), ''),
    nullif(left(p->>'plan', 20), ''), nullif(left(p->>'billing', 10), ''), nullif(left(p->>'domain', 120), ''), now(),
    nullif(left(p->>'terms_version', 20), ''), nullif(left(p->>'privacy_version', 20), ''),
    case when (p->>'quoted_total') ~ '^\d{1,9}$' then (p->>'quoted_total')::integer end, coalesce((p->>'beta_discount')::boolean, false))
  returning id into new_id;
  return new_id;
end $$;
revoke all on function public.apply_submit(text, jsonb) from public;
grant execute on function public.apply_submit(text, jsonb) to anon, authenticated;

-- ── 2) 부분 환불 ──
alter table payments add column if not exists refunded_amount bigint not null default 0;
create table if not exists payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments(id) on delete cascade,
  amount bigint not null check (amount > 0),
  reason text,
  refunded_by uuid references profiles(id) on delete set null,
  provider_ref text,
  created_at timestamptz not null default now()
);
create index if not exists payment_refunds_payment on payment_refunds(payment_id);
alter table payment_refunds enable row level security;
drop policy if exists "payment_refunds_read" on payment_refunds;
create policy "payment_refunds_read" on payment_refunds for select to authenticated
  using (coalesce(public.is_staff(), false) or exists (select 1 from payments p where p.id = payment_id and coalesce(public.is_outlet_editor(p.outlet_id), false)));

-- 서버: 결제사에서 환불이 끝난 뒤 기록. 전액이 되면 결제는 '취소·환불', 청구서는 (다른 완료 결제가 없으면) 미납으로
create or replace function public.payment_refund_record(secret text, p_payment_id uuid, p_amount bigint, p_reason text, p_user uuid, p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype; total_refunded bigint; full_refund boolean;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  select * into p from payments where id = p_payment_id for update;
  if p.id is null then raise exception '결제를 찾지 못했습니다.'; end if;
  if p.status <> 'done' then raise exception '환불할 수 있는 결제가 아닙니다.'; end if;
  if p_amount <= 0 or p.refunded_amount + p_amount > p.amount then raise exception '환불 금액이 남은 결제 금액보다 많습니다.'; end if;
  insert into payment_refunds (payment_id, amount, reason, refunded_by, provider_ref) values (p.id, p_amount, left(p_reason, 300), p_user, left(p_ref, 200));
  total_refunded := p.refunded_amount + p_amount;
  full_refund := total_refunded >= p.amount;
  update payments set refunded_amount = total_refunded, status = case when full_refund then 'canceled' else status end, updated_at = now() where id = p.id;
  if full_refund and not p.test_mode
     and not exists (select 1 from payments where invoice_id = p.invoice_id and status = 'done' and id <> p.id and not needs_review) then
    update invoices set status = 'unpaid', paid_at = null where id = p.invoice_id;
  end if;
  return jsonb_build_object('invoiceId', p.invoice_id, 'refunded', total_refunded, 'amount', p.amount, 'full', full_refund);
end $$;
revoke all on function public.payment_refund_record(text, uuid, bigint, text, uuid, text) from public;
grant execute on function public.payment_refund_record(text, uuid, bigint, text, uuid, text) to anon, authenticated;

-- 환불 화면이 남은 금액을 알 수 있게 (payments.sql 의 같은 함수에 환불 누계를 더한다)
create or replace function public.payment_lookup(secret text, p_payment_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('orderId', order_id, 'paymentKey', payment_key, 'amount', amount, 'status', status, 'testMode', test_mode, 'provider', provider,
    'refunded', refunded_amount, 'invoiceId', invoice_id)
  from payments where id = p_payment_id and public.payment_secret_ok(secret);
$$;
revoke all on function public.payment_lookup(text, uuid) from public;
grant execute on function public.payment_lookup(text, uuid) to anon, authenticated;

-- ── 3) 자동결제 정기결제 동의·해지 기록 ──
alter table consents add column if not exists outlet_id uuid references outlets(id) on delete set null;
alter table consents drop constraint if exists consents_kind_check;
alter table consents add constraint consents_kind_check check (kind in ('terms', 'privacy', 'autopay', 'autopay_cancel'));
drop policy if exists "consents_read" on consents;
create policy "consents_read" on consents for select to authenticated
  using (user_id = auth.uid() or coalesce(public.is_staff(), false) or (outlet_id is not null and coalesce(public.is_outlet_editor(outlet_id), false)));
alter table outlet_autopay add column if not exists consent_at timestamptz;

create or replace function public.record_autopay_consent(o uuid, p_kind text, p_version text) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); e text;
begin
  if u is null then raise exception '로그인이 필요합니다.'; end if;
  if p_kind not in ('autopay', 'autopay_cancel') then raise exception '잘못된 기록입니다.'; end if;
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then raise exception '이 매체의 자동결제를 다룰 권한이 없습니다.'; end if;
  select email into e from auth.users where id = u;
  insert into consents (user_id, email, kind, version, source, outlet_id) values (u, e, p_kind, left(coalesce(p_version, ''), 20), 'billing', o);
  if p_kind = 'autopay' then update outlet_autopay set consent_at = now() where outlet_id = o; end if;
end $$;
revoke all on function public.record_autopay_consent(uuid, text, text) from public, anon;
grant execute on function public.record_autopay_consent(uuid, text, text) to authenticated;

-- ── 4) 결제 완료·환불 안내 메일: 청구서 안내와 같은 사람 ──
create or replace function public.mail_recipients(secret text, p_kind text, p_ref uuid)
returns table (email text, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_kind = 'article_submitted' then
    return query
      select distinct u.email::text, p.full_name
      from articles a
      join outlets o on o.id = a.outlet_id
      join profiles p on p.id <> a.author_id and coalesce(p.email_notify, true) and (
        (p.role in ('editor', 'admin') and p.outlet_id = a.outlet_id)
        or exists (select 1 from outlet_members m where m.profile_id = p.id and m.outlet_id = a.outlet_id and m.role = 'editor')
        or (p.role = 'admin' and p.publisher_id is not null and p.publisher_id = o.publisher_id))
      join auth.users u on u.id = p.id
      where a.id = p_ref and a.status::text = 'in_review' and u.email is not null;
  elsif p_kind in ('article_rejected', 'article_published') then
    return query
      select u.email::text, p.full_name
      from articles a join profiles p on p.id = a.author_id join auth.users u on u.id = p.id
      where a.id = p_ref and coalesce(p.email_notify, true) and u.email is not null
        and a.status::text = case p_kind when 'article_rejected' then 'rejected' else 'published' end;
  elsif p_kind = 'ticket_staff_reply' then
    return query
      select u.email::text, p.full_name
      from support_tickets t join profiles p on p.id = t.requester_id join auth.users u on u.id = p.id
      where t.id = p_ref and coalesce(p.email_notify, true) and u.email is not null;
  elsif p_kind = 'ticket_customer_reply' then
    return query
      select u.email::text, p.full_name
      from support_tickets t
      join profiles p on (t.assigned_to is not null and p.id = t.assigned_to) or (t.assigned_to is null and coalesce(p.is_super, false))
      join auth.users u on u.id = p.id
      where t.id = p_ref and coalesce(p.email_notify, true) and u.email is not null;
  elsif p_kind in ('invoice_issued', 'invoice_overdue', 'invoice_hold', 'payment_done', 'payment_refunded') then
    return query
      select b.manager_email, b.manager_name
      from invoices i join outlet_billing b on b.outlet_id = i.outlet_id
      where i.id = p_ref and nullif(trim(b.manager_email), '') is not null
      union
      select u.email::text, p.full_name
      from invoices i join outlets o on o.id = i.outlet_id
      join profiles p on p.role = 'admin' and p.publisher_id = o.publisher_id
      join auth.users u on u.id = p.id
      where i.id = p_ref and u.email is not null
        and not exists (select 1 from outlet_billing b where b.outlet_id = i.outlet_id and nullif(trim(b.manager_email), '') is not null);
  end if;
end $$;
revoke all on function public.mail_recipients(text, text, uuid) from public;
grant execute on function public.mail_recipients(text, text, uuid) to anon, authenticated;

-- ── 6) 매체를 지워도 청구서·결제 기록은 남긴다 ──
alter table invoices add column if not exists outlet_name text;
alter table invoices add column if not exists bill_to_snapshot jsonb;
alter table payments add column if not exists outlet_name text;
update invoices i set outlet_name = o.name from outlets o where o.id = i.outlet_id and i.outlet_name is null;
update payments p set outlet_name = o.name from outlets o where o.id = p.outlet_id and p.outlet_name is null;
create or replace function public.billing_set_outlet_name() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outlet_name is null and new.outlet_id is not null then select name into new.outlet_name from outlets where id = new.outlet_id; end if;
  return new;
end $$;
drop trigger if exists invoices_outlet_name on invoices;
create trigger invoices_outlet_name before insert on invoices for each row execute function public.billing_set_outlet_name();
drop trigger if exists payments_outlet_name on payments;
create trigger payments_outlet_name before insert on payments for each row execute function public.billing_set_outlet_name();
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.invoices'::regclass and contype = 'f' and confrelid = 'public.outlets'::regclass loop
    execute format('alter table public.invoices drop constraint %I', c);
  end loop;
  alter table public.invoices alter column outlet_id drop not null;
  alter table public.invoices add constraint invoices_outlet_id_fkey foreign key (outlet_id) references public.outlets(id) on delete set null;
  for c in select conname from pg_constraint where conrelid = 'public.payments'::regclass and contype = 'f' and confrelid = 'public.outlets'::regclass loop
    execute format('alter table public.payments drop constraint %I', c);
  end loop;
  alter table public.payments alter column outlet_id drop not null;
  alter table public.payments add constraint payments_outlet_id_fkey foreign key (outlet_id) references public.outlets(id) on delete set null;
end $$;

-- ── 5) 해지 ──
alter table outlets add column if not exists terminated_at timestamptz;
alter table outlets add column if not exists terminate_reason text;
alter table outlets add column if not exists purge_after date;
create table if not exists outlet_purges (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid,
  outlet_name text,
  terminated_at timestamptz,
  terminate_reason text,
  purged_at timestamptz not null default now(),
  purged_by uuid references profiles(id) on delete set null,
  files_deleted integer not null default 0
);
alter table outlet_purges enable row level security;
drop policy if exists "outlet_purges_staff" on outlet_purges;
create policy "outlet_purges_staff" on outlet_purges for select to authenticated using (coalesce(public.is_staff(), false));

-- 해지 처리 (총관리자): 자동 청구·자동결제를 멈추고, 30일 뒤 지울 날을 정한다. 홈페이지·편집국 자료는 그때까지 그대로 (자료 내보내기 가능)
create or replace function public.admin_terminate_outlet(o uuid, p_reason text) returns text
language plpgsql security definer set search_path = public, private as $$
declare nm text;
begin
  if not coalesce(public.is_super(), false) then raise exception '해지 처리는 총관리자만 할 수 있습니다.'; end if;
  select name into nm from outlets where id = o;
  if nm is null then raise exception '매체를 찾지 못했습니다.'; end if;
  update outlets set terminated_at = now(), terminate_reason = left(p_reason, 300),
    purge_after = (now() at time zone 'Asia/Seoul')::date + 30 where id = o;
  update outlet_plans set auto = false, updated_at = now() where outlet_id = o or bill_to = o;
  update outlet_autopay set active = false where outlet_id = o;
  delete from private.billing_keys where outlet_id = o;
  return nm;
end $$;
revoke all on function public.admin_terminate_outlet(uuid, text) from public, anon;
grant execute on function public.admin_terminate_outlet(uuid, text) to authenticated;

-- 해지 취소 (다시 쓰기로 한 경우). 자동 청구·자동결제는 다시 켜야 한다
create or replace function public.admin_cancel_termination(o uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_super(), false) then raise exception '총관리자만 할 수 있습니다.'; end if;
  update outlets set terminated_at = null, terminate_reason = null, purge_after = null where id = o;
end $$;
revoke all on function public.admin_cancel_termination(uuid) from public, anon;
grant execute on function public.admin_cancel_termination(uuid) to authenticated;

-- 자료 지우기 (총관리자, 지울 날이 지난 해지 매체만): 청구서·결제 기록은 매체 이름·청구 정보를 남겨 둔 채 보관하고,
--   소속 회원은 소속을 풀고 출입을 막은 뒤 매체(기사·섹션·광고·설정 등)를 지운다. 사진 파일은 화면(서버)이 먼저 지운다
create or replace function public.admin_purge_outlet(o uuid, p_files integer default 0) returns text
language plpgsql security definer set search_path = public as $$
declare r outlets%rowtype; grp uuid; ids uuid[];
begin
  if not coalesce(public.is_super(), false) then raise exception '자료 지우기는 총관리자만 할 수 있습니다.'; end if;
  select * into r from outlets where id = o;
  if r.id is null then raise exception '매체를 찾지 못했습니다.'; end if;
  if r.terminated_at is null or r.purge_after is null then raise exception '해지 처리한 매체만 지울 수 있습니다.'; end if;
  if r.purge_after > (now() at time zone 'Asia/Seoul')::date then raise exception '%부터 지울 수 있습니다 (해지 후 30일 보관).', r.purge_after; end if;
  grp := r.publisher_id;
  update invoices i set outlet_name = coalesce(i.outlet_name, r.name),
    bill_to_snapshot = coalesce(i.bill_to_snapshot, (select to_jsonb(b) - 'outlet_id' from outlet_billing b where b.outlet_id = o))
  where i.outlet_id = o;
  update payments set outlet_name = coalesce(outlet_name, r.name) where outlet_id = o;
  -- 이 매체 소속 회원만: 소속을 풀고 승인을 거두며, 출입 정지 칸이 있으면 정지 (운영팀 계정은 건드리지 않는다)
  select coalesce(array_agg(p.id), '{}') into ids from profiles p
  where p.outlet_id = o and not coalesce((to_jsonb(p) ->> 'is_super')::boolean, false) and not coalesce((to_jsonb(p) ->> 'is_staff')::boolean, false);
  update profiles set outlet_id = null where outlet_id = o;
  begin execute 'update profiles set approved = false where id = any($1)' using ids; exception when undefined_column then null; end;
  begin execute 'update profiles set suspended_at = coalesce(suspended_at, now()) where id = any($1)' using ids; exception when undefined_column then null; end;
  insert into outlet_purges (outlet_id, outlet_name, terminated_at, terminate_reason, purged_by, files_deleted)
  values (o, r.name, r.terminated_at, r.terminate_reason, auth.uid(), coalesce(p_files, 0));
  delete from outlets where id = o;
  if to_regprocedure('public.cleanup_solo(uuid)') is not null then perform public.cleanup_solo(grp); end if;
  return r.name;
end $$;
revoke all on function public.admin_purge_outlet(uuid, integer) from public, anon;
grant execute on function public.admin_purge_outlet(uuid, integer) to authenticated;

-- 자료 지우기 전에 지울 사진 목록 (총관리자): 그 매체 폴더의 사진 중 다른 매체 기사(공유·송고된 기사)가 쓰지 않는 것만
create or replace function public.admin_outlet_media(o uuid) returns setof text
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.is_super(), false) then raise exception '총관리자만 볼 수 있습니다.'; end if;
  if to_regclass('storage.objects') is null then return; end if;
  return query execute $q$
    with refs as (
      select coalesce(a.body, '') || ' ' || coalesce(a.thumbnail_url, '') as t from public.articles a
      where a.outlet_id is distinct from $1
        and (a.body like '%media/' || $1::text || '/%' or a.thumbnail_url like '%media/' || $1::text || '/%')
    )
    select so.name::text from storage.objects so
    where so.bucket_id = 'media' and so.name like $1::text || '/%'
      and not exists (select 1 from refs where refs.t like '%' || so.name || '%')
  $q$ using o;
end $$;
revoke all on function public.admin_outlet_media(uuid) from public, anon;
grant execute on function public.admin_outlet_media(uuid) to authenticated;

-- 자료 지우기 때 사진 파일도 지울 수 있게 (총관리자만, media 저장소)
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "media_delete_super" on storage.objects';
    execute 'create policy "media_delete_super" on storage.objects for delete to authenticated using (bucket_id = ''media'' and coalesce(public.is_super(), false))';
  end if;
end $$;

select '계약·결제 안전장치 2 설치 완료' as "결과";
