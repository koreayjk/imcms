-- 회원가입 때 소속 매체 고르기 (Supabase SQL 에디터에서 실행, staff.sql 다음)
--   가입자가 고른 매체(requested_outlet_id)의 그룹 발행인이 가입 신청을 보고 승인·거절한다
--   매체를 고르지 않은(모름) 신청은 지금처럼 총관리자가 처리한다
--   groups.sql·staff.sql을 다시 실행했다면 이 파일도 다시 실행해야 한다

alter table profiles add column if not exists requested_outlet_id uuid references outlets(id) on delete set null;

-- 승인 전 가입자가 신청한 매체의 그룹 (승인되면 null)
create or replace function public.pending_publisher(pid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select o.publisher_id from profiles p join outlets o on o.id = p.requested_outlet_id
  where p.id = pid and p.approved = false and p.outlet_id is null and p.publisher_id is null and not coalesce(p.is_super, false);
$$;
grant execute on function public.pending_publisher(uuid) to authenticated;

-- 가입 화면용 매체 목록 (로그인 전에도 이름만)
create or replace function public.signup_outlets()
returns table (id uuid, name text) language sql stable security definer set search_path = public as $$
  select o.id, o.name from outlets o order by o.name;
$$;
revoke all on function public.signup_outlets() from public;
grant execute on function public.signup_outlets() to anon, authenticated;

-- 승인 전 가입자가 신청 매체를 정하거나 바꾼다 (구글 가입·승인 대기 화면)
create or replace function public.set_requested_outlet(o uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if o is not null and not exists (select 1 from outlets where id = o) then raise exception '없는 매체입니다.'; end if;
  update profiles set requested_outlet_id = o
  where id = auth.uid() and approved = false and outlet_id is null and publisher_id is null;
end $$;
revoke all on function public.set_requested_outlet(uuid) from public, anon;
grant execute on function public.set_requested_outlet(uuid) to authenticated;

-- 새 가입자: 초대가 있으면 초대대로, 없으면 가입 화면에서 고른 매체를 신청 매체로 기억
create or replace function handle_new_user()
returns trigger as $$
declare
  inv invitations%rowtype;
  req uuid;
begin
  select * into inv from invitations where lower(email) = lower(new.email) and accepted_at is null order by created_at desc limit 1;
  begin
    req := nullif(new.raw_user_meta_data->>'requested_outlet_id', '')::uuid;
  exception when others then req := null;
  end;
  if req is not null and not exists (select 1 from outlets where id = req) then req := null; end if;
  insert into public.profiles (id, full_name, role, approved, outlet_id, publisher_id, requested_outlet_id)
  values (
    new.id,
    coalesce(nullif(trim(inv.full_name), ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    coalesce(inv.role, 'reporter'),
    inv.id is not null,
    inv.outlet_id,
    case when inv.role = 'admin' then inv.publisher_id end,
    case when inv.id is null then req end
  );
  if inv.id is not null then update invitations set accepted_at = now() where id = inv.id; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 회원 보기: 본인 · 운영팀 · 같은 그룹 · (발행인) 우리 매체로 가입 신청한 사람
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select to authenticated
  using (
    id = auth.uid() or public.is_staff()
    or (public.my_publisher() is not null and public.profile_publisher(id) = public.my_publisher())
    or (public.is_group_admin() and public.pending_publisher(id) = public.my_publisher())
  );

-- 회원 바꾸기(승인 포함): 총관리자 · 같은 그룹 발행인 · 우리 매체로 신청한 가입자의 발행인
drop policy if exists "profiles_update_manager" on profiles;
create policy "profiles_update_manager" on profiles for update to authenticated
  using (public.is_super() or (public.is_group_admin() and (public.profile_publisher(id) = public.my_publisher() or public.pending_publisher(id) = public.my_publisher())))
  -- 바꾼 뒤의 값(새 행)으로 확인: 우리 그룹 매체·그룹으로만 배정할 수 있다
  with check (public.is_super() or (public.is_group_admin() and coalesce(publisher_id, public.outlet_publisher(outlet_id)) = public.my_publisher()));

-- 회원 이메일: 총관리자는 전체, 발행인은 자기 그룹 + 우리 매체로 신청한 가입자
create or replace function public.admin_list_users()
returns table (id uuid, email text, provider text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_group_admin() then raise exception '발행인 또는 총관리자만 볼 수 있습니다.'; end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data->>'provider', 'email'), u.last_sign_in_at
    from auth.users u
    where public.is_super() or public.profile_publisher(u.id) = public.my_publisher() or public.pending_publisher(u.id) = public.my_publisher();
end $$;

-- 가입 거절(계정 삭제): 총관리자, 또는 우리 매체로 신청한 승인 대기자의 발행인
create or replace function public.admin_reject_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  -- 값이 비면(null) 조건 전체가 null이 되어 통과되지 않도록 coalesce로 거짓 처리
  if not coalesce(public.is_super() or (public.is_group_admin() and public.pending_publisher(target) = public.my_publisher()), false) then
    raise exception '이 가입 신청을 거절할 권한이 없습니다.';
  end if;
  if target = auth.uid() or exists (select 1 from profiles where id = target and (approved or role = 'admin' or is_super)) then
    raise exception '승인 대기 중인 계정만 거절할 수 있습니다.';
  end if;
  delete from auth.users where id = target;
end $$;
