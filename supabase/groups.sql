-- 그룹(발행인)별 분리 + 총관리자 (Supabase SQL 에디터에서 실행 — 다른 SQL을 모두 실행한 뒤 마지막에)
--
--   총관리자  : 모든 그룹·매체·회원 (IM 뉴스룸 운영)
--   발행인    : 자기 그룹의 매체 여러 개를 만들고, 그룹 안 회원·기사·홈편집·청구서를 관리 (role = 'admin' + publisher_id)
--   편집장    : 자기 매체 (role = 'editor' + outlet_id)
--   기자      : 자기 기사 (role = 'reporter')
--
-- 그룹끼리는 기사·회원·직접 받은 보도자료·업무요청·청구서가 서로 보이지 않는다.
-- 여러 번 실행해도 안전하다.

-- ───────── 1. 표와 칸 ─────────
create table if not exists publishers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
alter table outlets add column if not exists publisher_id uuid references publishers(id) on delete set null;
alter table profiles add column if not exists is_super boolean not null default false;
alter table profiles add column if not exists publisher_id uuid references publishers(id) on delete set null;

-- 가입 승인 칸 (signup.sql을 아직 안 했어도 기존 계정이 막히지 않게 같은 방식으로)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'approved') then
    alter table public.profiles add column approved boolean not null default false;
    update public.profiles set approved = true;
  end if;
end $$;

-- 초대: 이메일로 미리 역할·그룹·매체를 정해 두면, 그 이메일로 가입하는 순간 바로 적용·승인된다
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  full_name text,
  role user_role not null default 'reporter',
  publisher_id uuid not null references publishers(id) on delete cascade,
  outlet_id uuid references outlets(id) on delete set null,
  invited_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create unique index if not exists invitations_open_email on invitations (lower(email)) where accepted_at is null;

-- ───────── 2. 권한 도우미 ─────────
create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super from profiles where id = auth.uid()), false);
$$;

create or replace function public.outlet_publisher(o uuid) returns uuid language sql stable security definer set search_path = public as $$
  select publisher_id from outlets where id = o;
$$;

-- 회원이 속한 그룹: 발행인은 publisher_id, 나머지는 소속 매체의 그룹
create or replace function public.profile_publisher(pid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(p.publisher_id, o.publisher_id) from profiles p left join outlets o on o.id = p.outlet_id where p.id = pid;
$$;

create or replace function public.my_publisher() returns uuid language sql stable security definer set search_path = public as $$
  select public.profile_publisher(auth.uid());
$$;

create or replace function public.my_outlet() returns uuid language sql stable security definer set search_path = public as $$
  select outlet_id from profiles where id = auth.uid();
$$;

create or replace function public.is_group_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (select 1 from profiles where id = auth.uid() and role = 'admin' and publisher_id is not null);
$$;

-- 매체를 관리(편집장 권한)할 수 있는가: 총관리자 / 그 매체 그룹의 발행인 / 그 매체의 편집장
create or replace function public.can_manage_outlet(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or exists (
    select 1 from profiles p
    where p.id = auth.uid() and (
      (p.role = 'admin' and p.publisher_id is not null and p.publisher_id = (select publisher_id from outlets where id = o))
      or (p.role = 'editor' and p.outlet_id = o)
    )
  );
$$;

-- 매체를 볼 수 있는가: 총관리자 / 같은 그룹 / 내 매체
create or replace function public.can_view_outlet(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or o = public.my_outlet() or (public.my_publisher() is not null and public.outlet_publisher(o) = public.my_publisher());
$$;

grant execute on function public.is_super(), public.outlet_publisher(uuid), public.profile_publisher(uuid), public.my_publisher(),
  public.my_outlet(), public.is_group_admin(), public.can_manage_outlet(uuid), public.can_view_outlet(uuid) to authenticated;

-- ───────── 3. 그룹·초대 권한 ─────────
alter table publishers enable row level security;
drop policy if exists "publishers_select" on publishers;
create policy "publishers_select" on publishers for select to authenticated using (public.is_super() or id = public.my_publisher());
drop policy if exists "publishers_insert" on publishers;
create policy "publishers_insert" on publishers for insert to authenticated with check (public.is_super());
drop policy if exists "publishers_update" on publishers;
create policy "publishers_update" on publishers for update to authenticated
  using (public.is_super() or (public.is_group_admin() and id = public.my_publisher()));
drop policy if exists "publishers_delete" on publishers;
create policy "publishers_delete" on publishers for delete to authenticated using (public.is_super());

alter table invitations enable row level security;
drop policy if exists "invitations_manage" on invitations;
create policy "invitations_manage" on invitations for all to authenticated
  using (public.is_super() or (public.is_group_admin() and publisher_id = public.my_publisher()))
  with check (
    (public.is_super() or (public.is_group_admin() and publisher_id = public.my_publisher()))
    and (outlet_id is null or public.outlet_publisher(outlet_id) = publisher_id)
  );

-- ───────── 4. 매체 ─────────
drop policy if exists "outlets_select" on outlets;
create policy "outlets_select" on outlets for select to authenticated using (public.can_view_outlet(id));
drop policy if exists "outlets_insert" on outlets;
create policy "outlets_insert" on outlets for insert to authenticated
  with check (public.is_super() or (public.is_group_admin() and publisher_id = public.my_publisher()));
drop policy if exists "outlets_update" on outlets;
create policy "outlets_update" on outlets for update to authenticated
  using (public.is_super() or (public.is_group_admin() and publisher_id = public.my_publisher()))
  with check (public.is_super() or (public.is_group_admin() and publisher_id = public.my_publisher()));
drop policy if exists "outlets_delete" on outlets;
create policy "outlets_delete" on outlets for delete to authenticated using (public.is_super());

-- ───────── 5. 회원 ─────────
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_super() or (public.my_publisher() is not null and public.profile_publisher(id) = public.my_publisher()));
drop policy if exists "profiles_update_admin" on profiles;
drop policy if exists "profiles_update_manager" on profiles;
create policy "profiles_update_manager" on profiles for update to authenticated
  using (public.is_super() or (public.is_group_admin() and public.profile_publisher(id) = public.my_publisher()));

-- 로그인 없는 방문자(홈페이지)는 기사를 발행한 기자의 프로필만 (다른 회원 목록이 새지 않게)
drop policy if exists "public_profiles_select" on profiles;
create policy "public_profiles_select" on profiles for select to anon
  using (exists (select 1 from articles a where a.author_id = profiles.id and a.status = 'published'));

-- 권한·소속·승인·그룹을 바꿀 수 있는 사람 (SQL 에디터에서는 auth.uid()가 없어 허용)
create or replace function protect_profile_fields()
returns trigger as $$
declare
  me profiles%rowtype;
  mine uuid;
begin
  if auth.uid() is null or public.is_super() then return new; end if;
  if new.is_super is distinct from old.is_super then
    raise exception '총관리자 지정은 총관리자만 할 수 있습니다.';
  end if;
  if new.role is distinct from old.role or new.outlet_id is distinct from old.outlet_id
     or new.approved is distinct from old.approved or new.publisher_id is distinct from old.publisher_id then
    select * into me from profiles where id = auth.uid();
    mine := me.publisher_id;
    if me.role = 'admin' and mine is not null
       and (new.outlet_id is null or public.outlet_publisher(new.outlet_id) = mine)
       and (new.publisher_id is null or new.publisher_id = mine) then
      return new;  -- 발행인: 자기 그룹 안에서만
    end if;
    raise exception '권한·소속은 발행인 또는 총관리자만 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists profiles_protect_fields on profiles;
create trigger profiles_protect_fields before update on profiles for each row execute function protect_profile_fields();

-- 가입할 때: 초대가 있으면 그대로 적용·승인, 없으면 기자 + 승인 대기
create or replace function handle_new_user()
returns trigger as $$
declare inv invitations%rowtype;
begin
  select * into inv from invitations where lower(email) = lower(new.email) and accepted_at is null order by created_at desc limit 1;
  insert into public.profiles (id, full_name, role, approved, outlet_id, publisher_id)
  values (
    new.id,
    coalesce(nullif(trim(inv.full_name), ''), nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    coalesce(inv.role, 'reporter'),
    inv.id is not null,
    inv.outlet_id,
    case when inv.role = 'admin' then inv.publisher_id end
  );
  if inv.id is not null then update invitations set accepted_at = now() where id = inv.id; end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 이미 가입해서 아직 어디에도 속하지 않은 사람을 초대하면 바로 적용한다 (다른 그룹 회원은 건드리지 않음)
create or replace function apply_invitation_to_existing()
returns trigger as $$
declare uid uuid;
begin
  select u.id into uid from auth.users u join profiles p on p.id = u.id
  where lower(u.email) = lower(new.email) and p.outlet_id is null and p.publisher_id is null and not p.is_super;
  if uid is not null then
    update profiles set
      full_name = coalesce(nullif(trim(new.full_name), ''), full_name),
      role = new.role, approved = true, outlet_id = new.outlet_id,
      publisher_id = case when new.role = 'admin' then new.publisher_id end
    where id = uid;
    new.accepted_at := now();
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;
drop trigger if exists invitations_apply_existing on invitations;
create trigger invitations_apply_existing before insert on invitations for each row execute function apply_invitation_to_existing();

-- 관리자용: 회원 이메일 보기 (총관리자는 전체, 발행인은 자기 그룹)
create or replace function public.admin_list_users()
returns table (id uuid, email text, provider text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_group_admin() then raise exception '발행인 또는 총관리자만 볼 수 있습니다.'; end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data->>'provider', 'email'), u.last_sign_in_at
    from auth.users u
    where public.is_super() or public.profile_publisher(u.id) = public.my_publisher();
end $$;

-- 승인 대기 가입자 거절은 총관리자만 (어느 그룹인지 모르는 사람이므로)
create or replace function public.admin_reject_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_super() then raise exception '총관리자만 거절할 수 있습니다.'; end if;
  if target = auth.uid() or exists (select 1 from profiles where id = target and (approved or role = 'admin' or is_super)) then
    raise exception '승인 대기 중인 계정만 거절할 수 있습니다.';
  end if;
  delete from auth.users where id = target;
end $$;

-- ───────── 6. 기사·섹션·홈편집 ─────────
drop policy if exists "articles_select" on articles;
create policy "articles_select" on articles for select to authenticated
  using (author_id = auth.uid() or public.can_manage_outlet(outlet_id));
drop policy if exists "articles_insert" on articles;
create policy "articles_insert" on articles for insert to authenticated
  with check (
    public.can_manage_outlet(outlet_id)
    or (author_id = auth.uid() and (outlet_id is null or outlet_id = public.my_outlet()))
  );
drop policy if exists "articles_update" on articles;
create policy "articles_update" on articles for update to authenticated
  using (author_id = auth.uid() or public.can_manage_outlet(outlet_id))
  with check (public.can_manage_outlet(outlet_id) or (author_id = auth.uid() and (outlet_id is null or outlet_id = public.my_outlet())));
drop policy if exists "articles_delete" on articles;
create policy "articles_delete" on articles for delete to authenticated
  using (author_id = auth.uid() or public.can_manage_outlet(outlet_id));

drop policy if exists "categories_insert" on categories;
create policy "categories_insert" on categories for insert to authenticated with check (public.can_manage_outlet(outlet_id));
drop policy if exists "categories_update" on categories;
create policy "categories_update" on categories for update to authenticated using (public.can_manage_outlet(outlet_id));
drop policy if exists "categories_delete" on categories;
create policy "categories_delete" on categories for delete to authenticated using (public.can_manage_outlet(outlet_id));

do $$
begin
  if to_regclass('public.home_layouts') is not null then
    drop policy if exists "home_layouts_insert" on home_layouts;
    create policy "home_layouts_insert" on home_layouts for insert to authenticated with check (public.can_manage_outlet(outlet_id));
    drop policy if exists "home_layouts_update" on home_layouts;
    create policy "home_layouts_update" on home_layouts for update to authenticated using (public.can_manage_outlet(outlet_id));
  end if;
end $$;

-- ───────── 7. 보도자료: 자동 수집(공용)은 모두, 직접 등록·메일로 받은 것은 그 그룹만 ─────────
do $$
begin
  if to_regclass('public.press_releases') is not null then
    alter table press_releases add column if not exists publisher_id uuid references publishers(id) on delete cascade;
    alter table press_releases add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;
    update press_releases r set publisher_id = public.profile_publisher(r.created_by)
      where r.source_key in ('manual', 'email') and r.publisher_id is null and r.created_by is not null;

    create or replace function public.press_set_publisher() returns trigger language plpgsql security definer set search_path = public as $f$
    begin
      if new.source_key in ('manual', 'email') and new.publisher_id is null then
        new.publisher_id := public.profile_publisher(coalesce(new.created_by, auth.uid()));
      end if;
      return new;
    end $f$;
    drop trigger if exists press_set_publisher on press_releases;
    create trigger press_set_publisher before insert on press_releases for each row execute function public.press_set_publisher();

    drop policy if exists "press_releases_read" on press_releases;
    create policy "press_releases_read" on press_releases for select to authenticated
      using (publisher_id is null or publisher_id = public.my_publisher() or public.is_super());
    drop policy if exists "press_releases_update" on press_releases;
    create policy "press_releases_update" on press_releases for update to authenticated
      using (publisher_id is null or publisher_id = public.my_publisher() or public.is_super());
  end if;

  if to_regclass('public.press_attachments') is not null then
    drop policy if exists "press_attachments_read" on press_attachments;
    create policy "press_attachments_read" on press_attachments for select to authenticated
      using (exists (select 1 from press_releases r where r.id = press_release_id));
    drop policy if exists "press_attachments_update" on press_attachments;
    create policy "press_attachments_update" on press_attachments for update to authenticated
      using (exists (select 1 from press_releases r where r.id = press_release_id));
  end if;

  if to_regclass('public.beta_requests') is not null then
    drop policy if exists "beta_requests_admin_read" on beta_requests;
    create policy "beta_requests_admin_read" on beta_requests for select to authenticated using (public.is_super());
    drop policy if exists "beta_requests_admin_update" on beta_requests;
    create policy "beta_requests_admin_update" on beta_requests for update to authenticated using (public.is_super());
  end if;
end $$;

-- 메일 수신 서비스 설정은 총관리자만
create or replace function public.admin_press_mail_settings()
returns table (secret text, address text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 볼 수 있습니다.'; end if;
  return query select
    (select value from private.settings where key = 'press_mail_secret'),
    (select value from private.settings where key = 'press_mail_address');
end $$;
create or replace function public.admin_set_press_mail_address(p_address text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.is_super() then raise exception '총관리자만 바꿀 수 있습니다.'; end if;
  if p_address !~ '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception '수신 주소 형식이 올바르지 않습니다. 예: abc123@inbound.postmarkapp.com';
  end if;
  insert into private.settings (key, value) values ('press_mail_address', lower(p_address))
  on conflict (key) do update set value = excluded.value;
end $$;

-- ───────── 8. 고객센터: 운영팀 = 총관리자, 매체 관리자 = 발행인·편집장 ─────────
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super();
$$;
create or replace function public.is_outlet_editor(o uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.can_manage_outlet(o);
$$;
grant execute on function public.is_staff(), public.is_outlet_editor(uuid) to authenticated;

-- 승인 전 가입자는 그룹·초대 표도 못 쓴다
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_approved') then
    drop policy if exists "approved_only" on publishers;
    create policy "approved_only" on publishers as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved());
    drop policy if exists "approved_only" on invitations;
    create policy "approved_only" on invitations as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved());
  end if;
end $$;

-- ───────── 9. 처음 세팅: 총관리자·그룹·김경석 발행인 ─────────
do $$
declare
  g_kim uuid; g_me uuid; me uuid; kim uuid; ct uuid;
begin
  select id into g_kim from publishers where name = '김경석 그룹';
  if g_kim is null then insert into publishers (name) values ('김경석 그룹') returning id into g_kim; end if;
  select id into g_me from publishers where name = '총관리자 그룹';
  if g_me is null then insert into publishers (name) values ('총관리자 그룹') returning id into g_me; end if;

  -- 더케어타임즈는 김경석 그룹, 그 밖에 이미 있던 매체는 총관리자 그룹
  select id into ct from outlets where name like '%더케어타임즈%' order by created_at limit 1;
  if ct is not null then update outlets set publisher_id = g_kim where id = ct and publisher_id is null; end if;
  update outlets set publisher_id = g_me where publisher_id is null;

  -- 총관리자: koreayjk@gmail.com (먼저 매체 화면을 볼 수 있게 더케어타임즈로 시작)
  select id into me from auth.users where lower(email) = 'koreayjk@gmail.com';
  if me is not null then
    update profiles set is_super = true, role = 'admin', approved = true, publisher_id = g_me, outlet_id = coalesce(outlet_id, ct) where id = me;
  else
    raise notice 'koreayjk@gmail.com 계정을 찾지 못했습니다. 가입 후 이 SQL을 다시 실행하세요.';
  end if;

  -- 전에 만든 관리자 계정(테스트관리자 등)은 총관리자 그룹의 발행인으로
  update profiles set publisher_id = g_me where role = 'admin' and publisher_id is null and not is_super;
  -- 그 계정의 작업 매체가 다른 그룹 매체면 비운다 (보이기만 하고 관리는 못 하는 상태를 막기 위해)
  update profiles set outlet_id = null
  where role = 'admin' and not is_super and publisher_id = g_me and outlet_id is not null
    and public.outlet_publisher(outlet_id) is distinct from g_me;

  -- 김경석: 더케어타임즈 그룹 발행인 (그룹 안 매체를 모두 관리). 아직 가입 전이면 초대로 남겨 두고 가입하는 순간 적용
  select id into kim from auth.users where lower(email) = '84kskim@naver.com';
  if kim is not null then
    update profiles set full_name = '김경석', role = 'admin', approved = true, publisher_id = g_kim, outlet_id = coalesce(outlet_id, ct) where id = kim;
  elsif not exists (select 1 from invitations where lower(email) = '84kskim@naver.com' and accepted_at is null) then
    insert into invitations (email, full_name, role, publisher_id, outlet_id) values ('84kskim@naver.com', '김경석', 'admin', g_kim, ct);
  end if;
end $$;

-- 확인: select p.full_name, u.email, p.role, p.is_super, g.name as 그룹, o.name as 매체
--       from profiles p join auth.users u on u.id = p.id left join publishers g on g.id = public.profile_publisher(p.id) left join outlets o on o.id = p.outlet_id;
