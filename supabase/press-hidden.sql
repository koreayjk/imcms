-- 보도자료함 "맞춤 자료"에서 편집장 이상이 가린 자료 (운영 DB에는 이미 적용됨. 여러 번 실행해도 된다)
--   · 가려도 보도자료 원본은 지워지지 않고, 그 매체의 맞춤 자료에서만 안 보인다. 되돌리면 다시 나온다.
--   · press_hide / press_unhide: 그 매체 편집장 이상(또는 운영팀)만, 한 번에 50건까지
create table if not exists public.press_hidden (
  outlet_id uuid not null references public.outlets(id) on delete cascade,
  press_release_id uuid not null references public.press_releases(id) on delete cascade,
  hidden_by uuid references auth.users(id) on delete set null,
  hidden_at timestamptz not null default now(),
  primary key (outlet_id, press_release_id)
);
alter table public.press_hidden enable row level security;
drop policy if exists "press_hidden_read" on public.press_hidden;
create policy "press_hidden_read" on public.press_hidden for select to authenticated
  using (coalesce(public.can_view_outlet(outlet_id), false) or coalesce(public.is_staff(), false));
revoke all on public.press_hidden from anon;
grant select on public.press_hidden to authenticated;

create or replace function public.press_hide(o uuid, ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '편집장 이상만 보도자료를 가릴 수 있습니다.';
  end if;
  if ids is null or coalesce(array_length(ids, 1), 0) = 0 then return 0; end if;
  if array_length(ids, 1) > 50 then raise exception '한 번에 50건까지 가릴 수 있습니다.'; end if;
  insert into press_hidden (outlet_id, press_release_id, hidden_by)
  select o, p.id, auth.uid() from press_releases p where p.id = any(ids)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.press_unhide(o uuid, ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '편집장 이상만 가린 보도자료를 되돌릴 수 있습니다.';
  end if;
  if ids is null or coalesce(array_length(ids, 1), 0) = 0 then return 0; end if;
  if array_length(ids, 1) > 50 then raise exception '한 번에 50건까지 되돌릴 수 있습니다.'; end if;
  delete from press_hidden where outlet_id = o and press_release_id = any(ids);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.press_hide(uuid, uuid[]), public.press_unhide(uuid, uuid[]) from public, anon;
grant execute on function public.press_hide(uuid, uuid[]), public.press_unhide(uuid, uuid[]) to authenticated;
