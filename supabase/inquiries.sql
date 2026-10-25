-- 홈페이지 광고문의 (Supabase SQL 에디터에서 1회 실행. mail.sql·payment 비밀 열쇠(payment_secret_ok) 설정 다음, 여러 번 실행해도 된다)
--   독자·광고주가 홈페이지 "광고문의" 양식으로 보낸 글을 매체별로 저장하고, 그 매체 편집장·발행인에게 알림 메일을 보낸다
--   저장은 아래 함수(서버 열쇠 필요)로만 하고, 읽기·처리는 그 매체 편집장 이상(운영팀 포함)만 한다
create table if not exists public.site_inquiries (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  kind text not null default 'ad' check (kind in ('ad', 'tip')),
  name text,
  company text,
  phone text,
  email text,
  body text not null,
  status text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists site_inquiries_outlet_idx on public.site_inquiries (outlet_id, created_at desc);
alter table public.site_inquiries enable row level security;

drop policy if exists site_inquiries_select on public.site_inquiries;
create policy site_inquiries_select on public.site_inquiries for select
  using (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false));
drop policy if exists site_inquiries_update on public.site_inquiries;
create policy site_inquiries_update on public.site_inquiries for update
  using (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false))
  with check (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false));
drop policy if exists site_inquiries_delete on public.site_inquiries;
create policy site_inquiries_delete on public.site_inquiries for delete
  using (coalesce(public.is_staff(), false) or coalesce(public.is_outlet_editor(outlet_id), false));

-- 문의 저장 + 알림 받을 사람(그 매체 편집장·발행인) 돌려주기. 같은 사람이 짧은 시간에 반복하면 막는다
create or replace function public.inquiry_submit(secret text, o uuid, p_kind text, p_name text, p_company text, p_phone text, p_email text, p_body text)
returns table (to_email text, to_name text)
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  if not public.payment_secret_ok(secret) then raise exception 'forbidden'; end if;
  if p_kind not in ('ad', 'tip') then raise exception 'bad kind'; end if;
  if nullif(trim(p_body), '') is null then raise exception '내용을 적어 주세요.'; end if;
  if (select count(*) from site_inquiries i where i.outlet_id = o and i.created_at > now() - interval '1 hour') >= 30
     or (nullif(p_email, '') is not null and (select count(*) from site_inquiries i where i.outlet_id = o and lower(i.email) = lower(p_email) and i.created_at > now() - interval '1 hour') >= 3) then
    raise exception 'too many';
  end if;
  insert into site_inquiries (outlet_id, kind, name, company, phone, email, body)
  values (o, p_kind, left(trim(p_name), 60), left(trim(p_company), 100), left(trim(p_phone), 40), left(trim(p_email), 200), left(trim(p_body), 4000))
  returning id into new_id;
  return query
    select distinct u.email::text, p.full_name
    from outlets ou
    join profiles p on coalesce(p.email_notify, true) and (
      (p.role in ('editor', 'admin') and p.outlet_id = ou.id)
      or exists (select 1 from outlet_members m where m.profile_id = p.id and m.outlet_id = ou.id and m.role = 'editor')
      or (p.role = 'admin' and p.publisher_id is not null and p.publisher_id = ou.publisher_id))
    join auth.users u on u.id = p.id
    where ou.id = o and u.email is not null;
end $$;
revoke all on function public.inquiry_submit(text, uuid, text, text, text, text, text, text) from public;
grant execute on function public.inquiry_submit(text, uuid, text, text, text, text, text, text) to anon, authenticated;
