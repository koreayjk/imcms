-- 편집국 2단계 인증 · 회원 출입 정지 (Supabase SQL 에디터에서 실행, groups.sql·staff.sql 다음. 여러 번 실행해도 된다)
--   1) 2단계 인증(인증 앱 6자리 코드)을 켠 사람은 코드를 넣기 전까지 DB의 어떤 자료도 열 수 없다
--      (비밀번호가 새어 누가 화면을 거치지 않고 DB에 직접 요청해도 막힌다)
--   2) 출입 정지된 회원(퇴사자 등)은 로그인이 되어도 DB의 어떤 자료도 열 수 없다 (자기 기사 지우기도 막힘)
--   3) 발행인은 우리 그룹 기자·편집장을 정지·해제하고, 휴대폰을 잃어버린 회원의 2단계 인증을 초기화한다
--   4) 발행인이 "우리 그룹 발행인·편집장은 2단계 인증 필수"를 켤 수 있다 (총관리자·매니저는 항상 필수, 화면에서 안내)
--   groups.sql·staff.sql·support.sql을 다시 실행했거나 새 표를 만든 SQL을 실행했다면 이 파일도 다시 실행해야 한다

alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspended_by uuid references profiles(id) on delete set null;
alter table publishers add column if not exists require_mfa boolean not null default false;

-- 2단계 인증을 켠 사람인가 (확인된 인증 앱이 하나라도 있으면)
create or replace function public.mfa_enabled(uid uuid) returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.mfa_factors f where f.user_id = uid and f.status = 'verified');
$$;
revoke all on function public.mfa_enabled(uuid) from public, anon;
grant execute on function public.mfa_enabled(uuid) to authenticated;

-- 지금 로그인이 자료를 열어도 되는가: 정지되지 않았고, 2단계 인증을 켰다면 코드까지 넣은 로그인(aal2)
--   로그인하지 않은 요청(SQL 에디터·서버 작업)은 그대로 둔다
create or replace function public.session_ok() returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is null or (
    not exists (select 1 from profiles where id = auth.uid() and suspended_at is not null)
    and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' or not public.mfa_enabled(auth.uid()))
  );
$$;
grant execute on function public.session_ok() to authenticated, anon;

-- 모든 표에 한 줄 더: 위 조건을 통과한 로그인만 (원래 규칙은 그대로 두고 그 위에 겹쳐 건다)
--   (select …)로 감싸면 자기 표를 다시 읽는 규칙(함께 송고 사본 쓰기)과 부딪혀 무한 반복 오류가 나므로 함수만 부른다
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "zz_account_ok" on public.%I', t.relname);
    execute format('create policy "zz_account_ok" on public.%I as restrictive for all to authenticated using (public.session_ok()) with check (public.session_ok())', t.relname);
  end loop;
end $$;

-- 사진 저장소(storage)도 같은 조건
do $$
begin
  if to_regclass('storage.objects') is not null then
    drop policy if exists "zz_account_ok" on storage.objects;
    create policy "zz_account_ok" on storage.objects as restrictive for all to authenticated
      using (public.session_ok()) with check (public.session_ok());
  end if;
end $$;

-- 관리 권한 확인 함수에도 같은 조건 (DB 함수로 하는 관리 작업도 코드 없이는 못 하게)
create or replace function public.is_super() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_super from profiles where id = auth.uid()), false) and public.session_ok();
$$;
create or replace function public.is_group_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and publisher_id is not null) and public.session_ok());
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super() or (coalesce((select (to_jsonb(p) ->> 'is_staff')::boolean from profiles p where p.id = auth.uid()), false) and public.session_ok());
$$;

-- 정지된 계정인가 (승인 대기 화면에서 안내를 바꾼다. 정지된 사람은 자기 회원 정보도 못 읽는다)
create or replace function public.am_i_suspended() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_at is not null from profiles where id = auth.uid()), false);
$$;
grant execute on function public.am_i_suspended() to authenticated;

-- 이 회원을 관리할 수 있는가: 총관리자는 모두(다른 총관리자 빼고), 발행인은 우리 그룹 기자·편집장
create or replace function public.can_manage_member(target uuid) returns boolean language sql stable security definer set search_path = public as $$
  select target is distinct from auth.uid() and exists (
    select 1 from profiles t where t.id = target and not coalesce(t.is_super, false) and (
      public.is_super()
      or (public.is_group_admin() and not coalesce(t.is_staff, false) and t.role <> 'admin'
          and public.profile_publisher(target) is not distinct from public.my_publisher() and public.my_publisher() is not null)
    )
  );
$$;
grant execute on function public.can_manage_member(uuid) to authenticated;

-- 정지 칸은 아래 함수로만 바꾼다
create or replace function public.protect_suspension() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.suspended_at is distinct from old.suspended_at or new.suspended_by is distinct from old.suspended_by)
     and auth.uid() is not null and coalesce(current_setting('im.member_admin', true), '') <> '1' then
    raise exception '출입 정지는 회원 관리 화면에서만 바꿀 수 있습니다.';
  end if;
  return new;
end $$;
drop trigger if exists zz_protect_suspension on profiles;
create trigger zz_protect_suspension before update on profiles for each row execute function public.protect_suspension();

-- 출입 정지 · 해제 (퇴사자 등). 정지하면 바로 편집국과 DB 자료를 못 열고, 쓴 기사는 그대로 남는다
create or replace function public.admin_suspend_user(target uuid, suspend boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_member(target) then
    raise exception '우리 그룹의 기자·편집장만 정지할 수 있습니다.';
  end if;
  perform set_config('im.member_admin', '1', true);
  update profiles
    set suspended_at = case when suspend then coalesce(suspended_at, now()) end,
        suspended_by = case when suspend then auth.uid() end
    where id = target;
  perform set_config('im.member_admin', '', true);
end $$;
revoke all on function public.admin_suspend_user(uuid, boolean) from public, anon;
grant execute on function public.admin_suspend_user(uuid, boolean) to authenticated;

-- 2단계 인증 초기화 (휴대폰을 잃어버린 회원). 다음 로그인 때 인증 앱을 새로 등록한다
create or replace function public.admin_reset_mfa(target uuid) returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.can_manage_member(target) then
    raise exception '우리 그룹의 기자·편집장만 초기화할 수 있습니다.';
  end if;
  delete from auth.mfa_factors where user_id = target;
end $$;
revoke all on function public.admin_reset_mfa(uuid) from public, anon;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;

-- 회원 관리 화면: 보이는 회원의 2단계 인증 여부 (총관리자는 모두, 발행인은 우리 그룹)
create or replace function public.admin_member_mfa() returns table (id uuid, mfa boolean) language sql stable security definer set search_path = public, auth as $$
  select p.id, public.mfa_enabled(p.id) from profiles p
  where public.is_super()
     or (public.is_group_admin() and public.profile_publisher(p.id) is not distinct from public.my_publisher() and public.my_publisher() is not null);
$$;
revoke all on function public.admin_member_mfa() from public, anon;
grant execute on function public.admin_member_mfa() to authenticated;

-- 우리 그룹 발행인·편집장 2단계 인증 필수 (발행인이 켜고 끈다)
create or replace function public.set_group_require_mfa(on_off boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_admin() or public.my_publisher() is null then
    raise exception '발행인만 바꿀 수 있습니다.';
  end if;
  update publishers set require_mfa = on_off where id = public.my_publisher();
end $$;
revoke all on function public.set_group_require_mfa(boolean) from public, anon;
grant execute on function public.set_group_require_mfa(boolean) to authenticated;

-- 나는 2단계 인증이 필수인가: 총관리자·매니저 / 필수로 정한 그룹의 발행인·편집장
create or replace function public.my_mfa_required() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select coalesce(p.is_super, false) or coalesce(p.is_staff, false)
      or (p.role in ('admin', 'editor') and coalesce((select g.require_mfa from publishers g where g.id = public.profile_publisher(p.id)), false))
    from profiles p where p.id = auth.uid()
  ), false);
$$;
grant execute on function public.my_mfa_required() to authenticated;

-- 확인: 2단계 인증을 켠 회원 · 정지된 회원
select p.full_name as "회원",
  case when public.mfa_enabled(p.id) then '켬' else '-' end as "2단계 인증",
  case when p.suspended_at is not null then '정지' else '' end as "출입"
from profiles p
where coalesce(p.is_super, false) or coalesce(p.is_staff, false) or public.mfa_enabled(p.id) or p.suspended_at is not null
order by p.full_name;
