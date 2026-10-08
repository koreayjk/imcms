-- 고객센터: 업무요청·공지·청구서·결제 정보 (Supabase SQL 에디터에서 1회 실행)
-- 운영팀 = 관리자(admin). 회원사 = 매체(outlet). 편집장은 자기 매체의 요청·청구서를, 기자는 자기 요청만 본다

-- 권한 도우미
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function public.my_outlet() returns uuid language sql stable security definer set search_path = public as $$
  select outlet_id from profiles where id = auth.uid();
$$;
create or replace function public.is_outlet_editor(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and outlet_id = o and role in ('editor', 'admin'));
$$;

-- ── 업무요청 ──
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references outlets(id) on delete set null,
  requester_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  category text not null check (category in ('design', 'dev', 'billing', 'error', 'content', 'etc')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 20000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz,
  last_staff_reply_at timestamptz,
  requester_read_at timestamptz
);
create index if not exists support_tickets_outlet_idx on support_tickets (outlet_id, created_at desc);

create or replace function public.can_see_ticket(t uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from support_tickets s
    where s.id = t and (public.is_staff() or s.requester_id = auth.uid() or (s.outlet_id is not null and public.is_outlet_editor(s.outlet_id)))
  );
$$;

alter table support_tickets enable row level security;
drop policy if exists "tickets_select" on support_tickets;
-- 행의 칸으로 직접 확인한다 (요청 번호로 다시 찾으면 저장 직후에는 못 찾아 저장이 막힌다)
create policy "tickets_select" on support_tickets for select to authenticated
  using (public.is_staff() or requester_id = auth.uid() or (outlet_id is not null and public.is_outlet_editor(outlet_id)));
drop policy if exists "tickets_insert" on support_tickets;
create policy "tickets_insert" on support_tickets for insert to authenticated
  with check (requester_id = auth.uid() and outlet_id is not distinct from public.my_outlet() and status = 'received');
drop policy if exists "tickets_update_staff" on support_tickets;
create policy "tickets_update_staff" on support_tickets for update to authenticated using (public.is_staff());

-- 요청자가 답변을 읽음 표시
create or replace function public.mark_ticket_read(t uuid) returns void language sql security definer set search_path = public as $$
  update support_tickets set requester_read_at = now() where id = t and public.can_see_ticket(t) and not public.is_staff();
$$;

create table if not exists support_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index if not exists support_replies_ticket_idx on support_replies (ticket_id, created_at);
alter table support_replies enable row level security;
drop policy if exists "replies_select" on support_replies;
create policy "replies_select" on support_replies for select to authenticated using (public.can_see_ticket(ticket_id));
drop policy if exists "replies_insert" on support_replies;
create policy "replies_insert" on support_replies for insert to authenticated
  with check (author_id = auth.uid() and public.can_see_ticket(ticket_id));

-- 답변이 달리면: 운영팀 표시는 DB가 정하고(흉내 방지), 요청 상태·시각을 갱신
create or replace function public.on_support_reply() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.is_staff := public.is_staff();
  if new.is_staff then
    update support_tickets set updated_at = now(), last_staff_reply_at = now(),
      status = case when status = 'received' then 'in_progress' else status end
    where id = new.ticket_id;
  else
    update support_tickets set updated_at = now(), requester_read_at = now(),
      status = case when status = 'done' then 'in_progress' else status end, done_at = case when status = 'done' then null else done_at end
    where id = new.ticket_id;
  end if;
  return new;
end $$;
drop trigger if exists support_reply_trigger on support_replies;
create trigger support_reply_trigger before insert on support_replies for each row execute function public.on_support_reply();

-- 첨부파일 (비공개 저장소 support/요청ID/…)
create table if not exists support_files (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  reply_id uuid references support_replies(id) on delete cascade,
  path text not null,
  name text not null,
  size int not null,
  uploaded_by uuid not null default auth.uid() references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table support_files enable row level security;
drop policy if exists "files_select" on support_files;
create policy "files_select" on support_files for select to authenticated using (public.can_see_ticket(ticket_id));
drop policy if exists "files_insert" on support_files;
create policy "files_insert" on support_files for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_ticket(ticket_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('support', 'support', false, 20971520)
on conflict (id) do nothing;
drop policy if exists "support_upload" on storage.objects;
create policy "support_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'support' and public.can_see_ticket(((storage.foldername(name))[1])::uuid));
drop policy if exists "support_read" on storage.objects;
create policy "support_read" on storage.objects for select to authenticated
  using (bucket_id = 'support' and public.can_see_ticket(((storage.foldername(name))[1])::uuid));

-- ── 공지 ──
create table if not exists support_notices (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'notice' check (category in ('notice', 'update', 'maintenance', 'security')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null,
  pinned boolean not null default false,
  author_id uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table support_notices enable row level security;
drop policy if exists "notices_select" on support_notices;
create policy "notices_select" on support_notices for select to authenticated using (true);
drop policy if exists "notices_write" on support_notices;
create policy "notices_write" on support_notices for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── 결제 정보 (세금계산서 담당자) ──
create table if not exists outlet_billing (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  company_name text, biz_no text, ceo_name text, address text,
  manager_name text, manager_email text, manager_phone text,
  updated_at timestamptz not null default now()
);
alter table outlet_billing enable row level security;
drop policy if exists "billing_select" on outlet_billing;
create policy "billing_select" on outlet_billing for select to authenticated using (public.is_staff() or public.is_outlet_editor(outlet_id));
drop policy if exists "billing_insert" on outlet_billing;
create policy "billing_insert" on outlet_billing for insert to authenticated with check (public.is_staff() or public.is_outlet_editor(outlet_id));
drop policy if exists "billing_update" on outlet_billing;
create policy "billing_update" on outlet_billing for update to authenticated using (public.is_staff() or public.is_outlet_editor(outlet_id));

-- ── 청구서 ──
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  month date not null,
  items jsonb not null default '[]',
  supply_amount bigint not null default 0,
  vat bigint not null default 0,
  total bigint not null default 0,
  due_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  unique (outlet_id, month)
);
alter table invoices enable row level security;
drop policy if exists "invoices_select" on invoices;
create policy "invoices_select" on invoices for select to authenticated using (public.is_staff() or public.is_outlet_editor(outlet_id));
drop policy if exists "invoices_write" on invoices;
create policy "invoices_write" on invoices for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 승인 전 가입자는 막는다 (signup.sql을 실행했을 때)
do $$
declare t text;
begin
  if exists (select 1 from pg_proc where proname = 'is_approved') then
    foreach t in array array['support_tickets', 'support_replies', 'support_files', 'support_notices', 'outlet_billing', 'invoices'] loop
      execute format('drop policy if exists "approved_only" on public.%I', t);
      execute format('create policy "approved_only" on public.%I as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved())', t);
    end loop;
  end if;
end $$;

grant execute on function public.is_staff(), public.my_outlet(), public.is_outlet_editor(uuid), public.can_see_ticket(uuid), public.mark_ticket_read(uuid) to authenticated;
