-- IM 뉴스룸 매니저 + 총관리자 대시보드 (Supabase SQL 에디터에서 실행, outlet-sites.sql 다음)
--   매니저: 상담 신청·업무요청 처리, 공지, 대시보드·청구서 보기, 고객사 개설(새 그룹·첫 매체·발행인 초대)
--   매니저가 못 하는 것: 가입 승인, 회원 권한 변경, 매니저 지정, 청구서 발행, 다른 언론사 기사 쓰기·고치기

alter table profiles add column if not exists is_staff boolean not null default false;

create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or coalesce((select (to_jsonb(p) ->> 'is_staff')::boolean from profiles p where p.id = auth.uid()), false);
$$;
grant execute on function public.is_staff() to authenticated;

-- 매니저 지정·해제는 총관리자만 (기존 권한 보호 함수에 한 줄 더)
create or replace function protect_profile_fields()
returns trigger as $$
declare
  me profiles%rowtype;
  mine uuid;
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  if new.is_super is distinct from old.is_super or new.is_staff is distinct from old.is_staff then
    raise exception '총관리자·매니저 지정은 총관리자만 할 수 있습니다.';
  end if;
  if new.role is distinct from old.role or new.outlet_id is distinct from old.outlet_id
     or new.approved is distinct from old.approved or new.publisher_id is distinct from old.publisher_id then
    select * into me from profiles where id = auth.uid();
    mine := me.publisher_id;
    if me.role = 'admin' and mine is not null
       and (new.outlet_id is null or public.outlet_publisher(new.outlet_id) = mine)
       and (new.publisher_id is null or new.publisher_id = mine) then
      return new;
    end if;
    raise exception '권한·소속은 발행인 또는 총관리자만 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 매니저가 볼 수 있는 것: 모든 매체·그룹·회원 (처리하려면 누가 어느 매체인지 알아야 한다)
create or replace function public.can_view_outlet(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or o = public.my_outlet() or (public.my_publisher() is not null and public.outlet_publisher(o) = public.my_publisher());
$$;

drop policy if exists "publishers_select" on publishers;
create policy "publishers_select" on publishers for select to authenticated using (public.is_staff() or id = public.my_publisher());
drop policy if exists "publishers_insert" on publishers;
create policy "publishers_insert" on publishers for insert to authenticated with check (public.is_staff());

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or (public.my_publisher() is not null and public.profile_publisher(id) = public.my_publisher()));

-- 매체 추가·홈페이지 설정·그룹 이름은 IM 뉴스룸 운영팀(총관리자·매니저)만. 발행인은 업무요청으로 요청한다
drop policy if exists "outlets_insert" on outlets;
create policy "outlets_insert" on outlets for insert to authenticated with check (public.is_staff());
drop policy if exists "outlets_update" on outlets;
create policy "outlets_update" on outlets for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "publishers_update" on publishers;
create policy "publishers_update" on publishers for update to authenticated using (public.is_staff());
drop policy if exists "invitations_manage" on invitations;
create policy "invitations_manage" on invitations for all to authenticated
  using (public.is_staff() or (public.is_group_admin() and publisher_id = public.my_publisher()))
  with check (
    (public.is_staff() or (public.is_group_admin() and publisher_id = public.my_publisher()))
    and (outlet_id is null or public.outlet_publisher(outlet_id) = publisher_id)
  );
-- 새 매체의 기본 섹션도 매니저가 만든다
drop policy if exists "categories_insert" on categories;
create policy "categories_insert" on categories for insert to authenticated with check (public.is_staff() or public.can_manage_outlet(outlet_id));

-- 청구서: 발행·수정은 총관리자만, 매니저는 보기
drop policy if exists "invoices_write" on invoices;
create policy "invoices_write" on invoices for all to authenticated using (public.is_super()) with check (public.is_super());

-- ── 상담 신청: 담당자·상담 기록·개설 표시 ──
alter table beta_requests add column if not exists assigned_to uuid references profiles(id) on delete set null;
alter table beta_requests add column if not exists note text;
alter table beta_requests add column if not exists publisher_id uuid references publishers(id) on delete set null;
alter table beta_requests add column if not exists updated_at timestamptz not null default now();
drop policy if exists "beta_requests_admin_read" on beta_requests;
create policy "beta_requests_admin_read" on beta_requests for select to authenticated using (public.is_staff());
drop policy if exists "beta_requests_admin_update" on beta_requests;
create policy "beta_requests_admin_update" on beta_requests for update to authenticated using (public.is_staff());

-- ── 업무요청 담당자 ──
alter table support_tickets add column if not exists assigned_to uuid references profiles(id) on delete set null;

-- ── 대시보드: 매체별 숫자 (운영팀만, 기사 본문은 읽지 않고 개수만) ──
create or replace function public.platform_outlet_stats()
returns table (
  outlet_id uuid, published bigint, published_today bigint, published_week bigint, drafts_in_review bigint,
  last_published_at timestamptz, members bigint, open_tickets bigint, unpaid_invoices bigint, unpaid_total bigint
)
language plpgsql stable security definer set search_path = public as $$
declare today timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
begin
  if not public.is_staff() then raise exception '운영팀만 볼 수 있습니다.'; end if;
  return query
    select o.id,
      (select count(*) from articles a where a.outlet_id = o.id and a.status = 'published'),
      (select count(*) from articles a where a.outlet_id = o.id and a.status = 'published' and a.published_at >= today),
      (select count(*) from articles a where a.outlet_id = o.id and a.status = 'published' and a.published_at >= today - interval '6 days'),
      (select count(*) from articles a where a.outlet_id = o.id and a.status = 'in_review'),
      (select max(a.published_at) from articles a where a.outlet_id = o.id and a.status = 'published'),
      (select count(*) from profiles p where p.outlet_id = o.id),
      (select count(*) from support_tickets t where t.outlet_id = o.id and t.status <> 'done'),
      (select count(*) from invoices i where i.outlet_id = o.id and i.status = 'unpaid'),
      (select coalesce(sum(i.total), 0)::bigint from invoices i where i.outlet_id = o.id and i.status = 'unpaid')
    from outlets o;
end $$;
revoke all on function public.platform_outlet_stats() from public, anon;
grant execute on function public.platform_outlet_stats() to authenticated;
