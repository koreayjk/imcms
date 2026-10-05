-- 미납 처리: 매월 1일 발행 · 5일 납부 기한 · 5일 유예(10일까지) · 11일부터 편집국 이용 제한
--   (Supabase SQL 에디터에서 실행, billing-auto.sql · mail.sql 다음. 여러 번 실행해도 된다)
--   · 이용 제한: 기사 쓰기·고치기·발행과 AI 사용을 막는다 (보기는 됨). 매체 홈페이지는 그대로 열려 있다
--   · 추가 매체는 청구 받는 매체가 밀리면 함께 제한된다
--   · 결제(또는 운영팀의 납부 처리·청구서 삭제)로 밀린 청구서가 없어지면 바로 풀린다
--   · 운영팀(총관리자·매니저)과 예약 작업은 제한을 받지 않는다. 연체료는 없다

alter table outlets add column if not exists billing_hold boolean not null default false;
alter table outlets add column if not exists billing_hold_at timestamptz;

-- 유예 기간 (납부 기한 다음 날부터 며칠). 서버 코드 lib/billing.ts 의 GRACE_DAYS 와 같게
create or replace function public.billing_grace_days() returns integer language sql immutable as $$ select 5 $$;

-- 이 매체가 지금 제한되어야 하는지: 자기(또는 청구 받는 매체)의 미납 청구서가 유예 기간까지 지났는지
create or replace function public.billing_should_hold(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from invoices i
    where i.status = 'unpaid' and i.total > 0 and i.due_date is not null
      and i.due_date + public.billing_grace_days() < (now() at time zone 'Asia/Seoul')::date
      and (i.outlet_id = o or i.outlet_id = (select p.bill_to from outlet_plans p where p.outlet_id = o))
  )
$$;

-- 제한 풀기: 결제 등으로 밀린 청구서가 없어진 매체(와 그 추가 매체)
create or replace function public.billing_release(o uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update outlets set billing_hold = false, billing_hold_at = null
   where billing_hold and (id = o or id in (select p.outlet_id from outlet_plans p where p.bill_to = o))
     and not public.billing_should_hold(id);
end $$;

create or replace function public.billing_release_on_invoice() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.billing_release(coalesce(new.outlet_id, old.outlet_id));
  return coalesce(new, old);
end $$;
drop trigger if exists billing_release_on_invoice on invoices;
create trigger billing_release_on_invoice after update of status or delete on invoices
  for each row execute function public.billing_release_on_invoice();

-- 매일 예약 작업(서버 열쇠로만): 제한 걸기·풀기, 보낼 안내 목록
--   overdue: 납부 기한이 지났고 유예 기간 안 (미납 안내), hold: 오늘 새로 제한된 청구서 (이용 제한 안내)
create or replace function public.billing_dunning(secret text)
returns table (invoice_id uuid, outlet_id uuid, outlet_name text, month date, total bigint, due_date date, stage text, autopay boolean)
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  held uuid[];
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  -- 제한 풀기 (밀린 청구서가 없어진 매체)
  update outlets set billing_hold = false, billing_hold_at = null where billing_hold and not public.billing_should_hold(id);
  -- 새로 제한 (본 매체 + 추가 매체)
  with newly as (
    update outlets o set billing_hold = true, billing_hold_at = now()
     where not o.billing_hold and public.billing_should_hold(o.id)
    returning o.id
  ) select coalesce(array_agg(id), '{}') into held from newly;

  return query
    select i.id, i.outlet_id, o.name, i.month, i.total, i.due_date,
      case when i.due_date + public.billing_grace_days() < today then 'hold' else 'overdue' end,
      exists (select 1 from outlet_autopay a where a.outlet_id = i.outlet_id and a.active)
    from invoices i join outlets o on o.id = i.outlet_id
    where i.status = 'unpaid' and i.total > 0 and i.due_date is not null and i.due_date < today
      and (i.due_date + public.billing_grace_days() >= today or i.outlet_id = any(held));
end $$;
revoke all on function public.billing_dunning(text) from public;
grant execute on function public.billing_dunning(text) to anon, authenticated;

-- 제한 중인 매체: 로그인한 회원의 기사 쓰기·고치기·발행을 막는다 (운영팀·예약 작업·조회수 등 로그인 없는 처리는 그대로)
create or replace function public.billing_hold_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(public.is_staff(), false) then return coalesce(new, old); end if;
  if exists (select 1 from outlets where id = coalesce(new.outlet_id, old.outlet_id) and billing_hold) then
    raise exception '이용료가 밀려 편집국 이용이 제한되었습니다. 고객센터 → 청구서에서 결제하면 바로 풀립니다.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists billing_hold_guard on articles;
create trigger billing_hold_guard before insert or update or delete on articles for each row execute function public.billing_hold_guard();
drop trigger if exists billing_hold_guard on ai_usage;
create trigger billing_hold_guard before insert on ai_usage for each row execute function public.billing_hold_guard();

-- 알림 받는 사람: 청구서 발행 안내와 같은 사람 (결제 담당자, 없으면 그룹 발행인)
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
  elsif p_kind in ('invoice_issued', 'invoice_overdue', 'invoice_hold') then
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

-- 확인: 지금 제한 중인 매체
select name as "매체", billing_hold_at as "제한 시작" from outlets where billing_hold order by name;
