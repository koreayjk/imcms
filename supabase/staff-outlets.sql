-- IM 뉴스룸 매니저의 담당 매체 (Supabase SQL 에디터에서 실행, staff.sql 다음)
--   매니저는 매체에 소속되지 않고 "담당 매체"만 갖는다 (직급 없음)
--   담당 매체에서 업무요청이 들어오면 그 매니저에게 자동으로 배정된다
--   담당을 정해도 매니저가 볼 수 있는 범위는 그대로(전체)이고, 누가 처리할지만 정한다

create table if not exists staff_outlets (
  staff_id uuid not null references profiles(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (staff_id, outlet_id)
);
create index if not exists staff_outlets_outlet on staff_outlets(outlet_id);

alter table staff_outlets enable row level security;

-- 보기: 운영팀(총관리자·매니저) / 정하기: 총관리자만
drop policy if exists "staff_outlets_read" on staff_outlets;
create policy "staff_outlets_read" on staff_outlets for select to authenticated using (public.is_staff());
drop policy if exists "staff_outlets_write" on staff_outlets;
create policy "staff_outlets_write" on staff_outlets for all to authenticated
  using (public.is_super()) with check (public.is_super());

-- 총관리자: 매니저의 담당 매체를 한 번에 정한다 (빈 목록이면 담당 없음)
create or replace function public.admin_set_staff_outlets(target uuid, outlet_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception '담당 매체는 총관리자만 정할 수 있습니다.'; end if;
  if not exists (select 1 from profiles where id = target and coalesce(is_staff, false)) then
    raise exception '매니저만 담당 매체를 가질 수 있습니다.';
  end if;
  delete from staff_outlets where staff_id = target and not (outlet_id = any(coalesce(outlet_ids, '{}')));
  insert into staff_outlets (staff_id, outlet_id)
    select target, o.id from outlets o where o.id = any(coalesce(outlet_ids, '{}'))
    on conflict do nothing;
end $$;
revoke all on function public.admin_set_staff_outlets(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_staff_outlets(uuid, uuid[]) to authenticated;

-- 업무요청이 들어오면 그 매체 담당 매니저에게 자동 배정 (담당이 여럿이면 먼저 지정된 사람)
create or replace function assign_ticket_to_staff()
returns trigger as $$
begin
  if new.assigned_to is null and new.outlet_id is not null then
    select s.staff_id into new.assigned_to
    from staff_outlets s join profiles p on p.id = s.staff_id and coalesce(p.is_staff, false)
    where s.outlet_id = new.outlet_id
    order by s.created_at limit 1;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists support_tickets_assign_staff on support_tickets;
create trigger support_tickets_assign_staff before insert on support_tickets for each row execute function assign_ticket_to_staff();

-- 매니저로 지정하면 매체 소속(작업 매체·소속 목록)을 비우고, 해제하면 담당 매체를 지운다
create or replace function staff_change_cleanup()
returns trigger as $$
begin
  if coalesce(new.is_staff, false) and not coalesce(old.is_staff, false) and not coalesce(new.is_super, false) then
    new.outlet_id := null;
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'outlet_members') then
      execute 'delete from public.outlet_members where profile_id = $1' using new.id;
    end if;
  elsif coalesce(old.is_staff, false) and not coalesce(new.is_staff, false) then
    delete from staff_outlets where staff_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists profiles_clear_staff_outlets on profiles;
-- 이름이 protect 보다 앞이라 먼저 돈다 (작업 매체를 비운 뒤 권한 확인)
drop trigger if exists profiles_a_staff_cleanup on profiles;
create trigger profiles_a_staff_cleanup before update of is_staff on profiles for each row execute function staff_change_cleanup();

-- 매니저는 매체 소속이 아니므로, 지금 매니저인 사람의 매체 소속(작업 매체·소속 목록)을 비운다
update profiles set outlet_id = null where coalesce(is_staff, false) and not coalesce(is_super, false) and outlet_id is not null;
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'outlet_members') then
    delete from outlet_members m using profiles p where p.id = m.profile_id and coalesce(p.is_staff, false) and not coalesce(p.is_super, false);
  end if;
end $$;
