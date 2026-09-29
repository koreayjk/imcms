-- 회원가입(이메일·구글) + 관리자 승인 (Supabase SQL 에디터에서 1회 실행)
-- 누구나 가입할 수 있지만, 관리자가 승인하기 전에는 기사·사진·보도자료를 전혀 다룰 수 없다

-- 1) 승인 여부 칸. 처음 추가할 때만 기존 계정을 모두 승인 처리한다
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'approved'
  ) then
    alter table public.profiles add column approved boolean not null default false;
    update public.profiles set approved = true;
  end if;
end $$;

-- 2) 승인된 편집국 계정인지 (관리자는 항상 승인)
create or replace function public.is_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and (approved or role = 'admin'));
$$;
grant execute on function public.is_approved() to authenticated;

-- 3) 권한·소속·승인은 관리자만 바꿀 수 있다
create or replace function protect_profile_fields()
returns trigger as $$
begin
  if (new.role is distinct from old.role
      or new.outlet_id is distinct from old.outlet_id
      or new.approved is distinct from old.approved)
     and auth.uid() is not null
     and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  then
    raise exception '권한·소속·승인은 관리자만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4) 가입 시 프로필 생성: 구글은 name, 이메일 가입은 full_name. 항상 기자 + 승인 대기로 시작
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, approved)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
    'reporter',
    false
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) 승인 전에는 막는다 (restrictive: 기존 권한 규칙과 "그리고"로 함께 적용)
--    아직 만들지 않은 표(보도자료함 등)는 건너뛰므로, 나중에 그 SQL을 실행했다면 이 파일을 한 번 더 실행하세요
do $$
declare t text;
begin
  foreach t in array array['articles', 'media_assets', 'press_releases', 'press_fetch_log'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "approved_only" on public.%I', t);
      execute format('create policy "approved_only" on public.%I as restrictive for all to authenticated using (public.is_approved()) with check (public.is_approved())', t);
    end if;
  end loop;
  if to_regclass('public.home_layouts') is not null then
    drop policy if exists "approved_only_insert" on public.home_layouts;
    drop policy if exists "approved_only_update" on public.home_layouts;
    create policy "approved_only_insert" on public.home_layouts as restrictive for insert to authenticated with check (public.is_approved());
    create policy "approved_only_update" on public.home_layouts as restrictive for update to authenticated using (public.is_approved());
  end if;
end $$;

drop policy if exists "media_approved_insert" on storage.objects;
create policy "media_approved_insert" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'media' or public.is_approved());
drop policy if exists "media_approved_update" on storage.objects;
create policy "media_approved_update" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'media' or public.is_approved());
drop policy if exists "media_approved_delete" on storage.objects;
create policy "media_approved_delete" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'media' or public.is_approved());

-- 6) 관리자 전용: 가입자 이메일·가입 방법 보기 (이메일은 공개 프로필에 두지 않는다)
create or replace function public.admin_list_users()
returns table (id uuid, email text, provider text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from profiles where profiles.id = auth.uid() and role = 'admin') then
    raise exception '관리자만 볼 수 있습니다.';
  end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data->>'provider', 'email'), u.last_sign_in_at
    from auth.users u;
end $$;

-- 7) 관리자 전용: 승인 대기 가입자 거절(계정 삭제). 승인된 계정·관리자·본인은 지울 수 없다
create or replace function public.admin_reject_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'admin') then
    raise exception '관리자만 거절할 수 있습니다.';
  end if;
  if target = auth.uid() or exists (select 1 from profiles where id = target and (approved or role = 'admin')) then
    raise exception '승인 대기 중인 계정만 거절할 수 있습니다.';
  end if;
  delete from auth.users where id = target;
end $$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_reject_user(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_reject_user(uuid) to authenticated;
