-- 한 회원이 같은 그룹의 여러 매체에 속하고, 매체마다 직급(기자·편집장)을 따로 갖는다
-- (Supabase SQL 에디터에서 실행, signup-outlet.sql 다음)
--
-- 방식: 소속 목록은 outlet_members에 두고, profiles.outlet_id·role은 "지금 작업 중인 매체와 그 매체에서의 직급"으로 쓴다.
--       매체를 바꾸면 그 매체의 직급으로 함께 바뀌므로, 기존 권한 규칙(기사·홈편집·섹션)은 그대로 지금 매체 기준으로 동작한다.
-- 발행인(그룹 전체)·총관리자·매니저는 소속 목록 없이 지금처럼 동작한다.
-- groups.sql·staff.sql·signup-outlet.sql을 다시 실행했다면 이 파일도 다시 실행해야 한다.

create table if not exists outlet_members (
  profile_id uuid not null references profiles(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  role text not null check (role in ('reporter', 'editor')),
  created_at timestamptz not null default now(),
  primary key (profile_id, outlet_id)
);
create index if not exists outlet_members_outlet on outlet_members(outlet_id);

alter table outlet_members enable row level security;

-- 보기: 본인 · 운영팀 · 그 매체 그룹의 발행인. 쓰기는 아래 함수로만
drop policy if exists "outlet_members_select" on outlet_members;
create policy "outlet_members_select" on outlet_members for select to authenticated
  using (profile_id = auth.uid() or public.is_staff() or (public.is_group_admin() and public.outlet_publisher(outlet_id) = public.my_publisher()));

-- 지금 작업 중인 매체는 언제나 소속 목록에 있다 (승인·초대·발행인이 매체를 정할 때 자동으로 맞춘다)
-- 다른 그룹 매체 소속은 남기지 않는다 (같은 그룹 안에서만 여러 매체)
create or replace function sync_outlet_member()
returns trigger as $$
begin
  if new.outlet_id is not null and new.role in ('reporter', 'editor')
     and not coalesce(new.is_super, false) and not coalesce(new.is_staff, false) and coalesce(new.approved, true) then
    delete from outlet_members m
      where m.profile_id = new.id and public.outlet_publisher(m.outlet_id) is distinct from public.outlet_publisher(new.outlet_id);
    insert into outlet_members (profile_id, outlet_id, role) values (new.id, new.outlet_id, new.role::text)
      on conflict (profile_id, outlet_id) do update set role = excluded.role;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists profiles_sync_outlet_member on profiles;
create trigger profiles_sync_outlet_member after insert or update of outlet_id, role, approved, is_staff on profiles
  for each row execute function sync_outlet_member();

-- 지금 있는 기자·편집장을 소속 목록에 옮긴다
insert into outlet_members (profile_id, outlet_id, role)
select p.id, p.outlet_id, p.role::text from profiles p
where p.outlet_id is not null and p.role in ('reporter', 'editor')
  and not coalesce(p.is_super, false) and not coalesce(p.is_staff, false) and coalesce(p.approved, true)
on conflict (profile_id, outlet_id) do nothing;

-- 권한·소속 보호: 기존 규칙 + "본인이 소속된 매체로, 그 매체의 직급으로 바꾸기(매체 이동)"
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
    -- 매체 이동: 본인이, 승인·그룹은 그대로 두고, 소속된 매체와 그 매체의 직급으로만
    if new.id = auth.uid() and old.approved is not false
       and new.approved is not distinct from old.approved and new.publisher_id is not distinct from old.publisher_id
       and old.role in ('reporter', 'editor')
       and exists (select 1 from outlet_members m where m.profile_id = new.id and m.outlet_id = new.outlet_id and m.role = new.role::text) then
      return new;
    end if;
    raise exception '권한·소속은 발행인 또는 총관리자만 바꿀 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 기자·편집장의 매체 이동 (상단바 매체 고르기)
create or replace function public.switch_my_outlet(o uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r text;
begin
  select m.role into r from outlet_members m where m.profile_id = auth.uid() and m.outlet_id = o;
  if r is null then raise exception '소속된 매체가 아닙니다.'; end if;
  update profiles set outlet_id = o, role = r::user_role where id = auth.uid();
end $$;
revoke all on function public.switch_my_outlet(uuid) from public, anon;
grant execute on function public.switch_my_outlet(uuid) to authenticated;

-- 발행인·총관리자: 회원의 소속 매체와 매체별 직급을 한 번에 정한다
--   items: [{"outlet_id": "...", "role": "reporter" | "editor"}, ...]  (같은 그룹 매체만, 1개 이상)
create or replace function public.admin_set_memberships(target uuid, items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  t profiles%rowtype;
  grp uuid;
  n int;
  groups int;
  cur_role text;
  first_outlet uuid;
  first_role text;
begin
  select * into t from profiles where id = target;
  if t.id is null then raise exception '회원을 찾지 못했습니다.'; end if;
  if coalesce(t.is_super, false) or coalesce(t.is_staff, false) then raise exception '총관리자·매니저는 소속 매체를 정하지 않습니다.'; end if;
  if target = auth.uid() then raise exception '내 소속은 스스로 바꿀 수 없습니다.'; end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then raise exception '소속 매체를 하나 이상 정해 주세요.'; end if;

  -- 매체·직급 확인, 모두 한 그룹이어야 한다
  begin
    select count(*), count(distinct o.publisher_id), min(o.publisher_id::text)::uuid into n, groups, grp
    from jsonb_array_elements(items) i join outlets o on o.id = (i->>'outlet_id')::uuid
    where i->>'role' in ('reporter', 'editor');
  exception when invalid_text_representation then
    raise exception '매체나 직급을 확인해 주세요.';
  end;
  if n <> jsonb_array_length(items) then raise exception '매체나 직급을 확인해 주세요.'; end if;
  if groups <> 1 or grp is null then raise exception '같은 그룹의 매체만 함께 소속될 수 있습니다.'; end if;

  -- 권한: 총관리자, 또는 그 그룹의 발행인 (회원이 지금 우리 그룹이거나 우리 매체로 신청한 사람)
  -- (값이 비면(null) 조건 전체가 null이 되어 통과되지 않도록 coalesce로 거짓 처리)
  if not coalesce(public.is_super() or (public.is_group_admin() and grp = public.my_publisher()
          and (coalesce(public.profile_publisher(target) = grp, false) or coalesce(public.pending_publisher(target) = grp, false))), false) then
    raise exception '이 회원의 소속을 정할 권한이 없습니다.';
  end if;

  delete from outlet_members m where m.profile_id = target
    and not exists (select 1 from jsonb_array_elements(items) i where (i->>'outlet_id')::uuid = m.outlet_id);
  insert into outlet_members (profile_id, outlet_id, role)
    select target, (i->>'outlet_id')::uuid, i->>'role' from jsonb_array_elements(items) i
    on conflict (profile_id, outlet_id) do update set role = excluded.role;

  -- 지금 작업 중인 매체: 계속 소속이면 그대로(직급만 맞춤), 아니면 첫 번째 매체로
  select i->>'role' into cur_role from jsonb_array_elements(items) i where (i->>'outlet_id')::uuid = t.outlet_id;
  select (i->>'outlet_id')::uuid, i->>'role' into first_outlet, first_role from jsonb_array_elements(items) i limit 1;
  update profiles set
    outlet_id = case when cur_role is not null then t.outlet_id else first_outlet end,
    role = coalesce(cur_role, first_role)::user_role,
    publisher_id = null
  where id = target;
end $$;
revoke all on function public.admin_set_memberships(uuid, jsonb) from public, anon;
grant execute on function public.admin_set_memberships(uuid, jsonb) to authenticated;
