-- 이미 schema.sql을 실행한 프로젝트에 1회 실행
-- 1) 관리자가 다른 사람의 권한·소속을 바꿀 수 있게 허용
-- 2) 관리자가 아닌 사람은 자기 권한·소속을 바꿀 수 없게 차단

create policy "profiles_update_admin" on profiles for update to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function protect_profile_fields()
returns trigger as $$
begin
  if (new.role is distinct from old.role or new.outlet_id is distinct from old.outlet_id)
     and auth.uid() is not null
     and not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  then
    raise exception '권한 또는 소속은 관리자만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger profiles_protect_fields
  before update on profiles
  for each row execute function protect_profile_fields();
