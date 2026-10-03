-- 개별 매체 · 그룹 삭제 (Supabase SQL 에디터에서 실행, groups.sql 다음. 여러 번 실행해도 된다)
--   그룹 = 한 회사가 여러 매체를 함께 운영하는 묶음. 그룹 발행인은 그룹 안 모든 매체를 관리한다
--   개별 매체 = 그룹 없이 혼자 운영하는 매체. 화면에서는 '개별 매체' 한 곳에 모아 보여주지만,
--     기사·회원·보도자료·청구서가 다른 매체와 섞이지 않도록 매체마다 숨은 그룹(solo)을 하나씩 둔다
--   그룹을 지우면 그 안의 매체는 모두 개별 매체가 되고, 각 매체 발행인·열린 초대도 따라간다

alter table publishers add column if not exists solo boolean not null default false;

-- 비어 있는 숨은 그룹 정리
create or replace function public.cleanup_solo(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if g is not null and exists (select 1 from publishers where id = g and solo)
     and not exists (select 1 from outlets where publisher_id = g) then
    delete from publishers where id = g;
  end if;
end $$;

-- 매체를 개별 매체로 (이미 개별이면 그대로)
create or replace function public.outlet_make_solo(o uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  old uuid;
  nm text;
  g uuid;
begin
  if not coalesce(public.is_super(), false) then raise exception '그룹은 총관리자만 바꿀 수 있습니다.'; end if;
  select publisher_id, name into old, nm from outlets where id = o;
  if nm is null then raise exception '매체를 찾지 못했습니다.'; end if;
  if old is not null and exists (select 1 from publishers where id = old and solo) then return old; end if;
  insert into publishers (name, solo) values (nm, true) returning id into g;
  update outlets set publisher_id = g where id = o;
  -- 이 매체 소속 발행인과 아직 받지 않은 초대도 함께 옮긴다 (총관리자는 그대로)
  update profiles set publisher_id = g
    where role = 'admin' and outlet_id = o and publisher_id is not distinct from old and not coalesce(is_super, false);
  update invitations set publisher_id = g where outlet_id = o and accepted_at is null;
  return g;
end $$;

-- 매체를 다른 그룹으로 (개별 매체였다면 비게 된 숨은 그룹은 지운다)
create or replace function public.outlet_move(o uuid, g uuid) returns void
language plpgsql security definer set search_path = public as $$
declare old uuid;
begin
  if not coalesce(public.is_super(), false) then raise exception '그룹은 총관리자만 바꿀 수 있습니다.'; end if;
  if not exists (select 1 from publishers where id = g and not solo) then raise exception '그룹을 찾지 못했습니다.'; end if;
  select publisher_id into old from outlets where id = o;
  if old is not distinct from g then return; end if;
  update outlets set publisher_id = g where id = o;
  update profiles set publisher_id = g
    where role = 'admin' and outlet_id = o and publisher_id is not distinct from old and not coalesce(is_super, false);
  update invitations set publisher_id = g where outlet_id = o and accepted_at is null;
  perform public.cleanup_solo(old);
end $$;

-- 그룹 지우기 (총관리자만): 안의 매체는 모두 개별 매체로
create or replace function public.delete_group(g uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  if not coalesce(public.is_super(), false) then raise exception '총관리자만 그룹을 지울 수 있습니다.'; end if;
  if not exists (select 1 from publishers where id = g and not solo) then raise exception '그룹을 찾지 못했습니다.'; end if;
  for r in select id from outlets where publisher_id = g loop
    perform public.outlet_make_solo(r.id);
    n := n + 1;
  end loop;
  -- 매체에 붙지 않은 그룹 단위 초대는 함께 없어지고, 남은 그룹 발행인은 그룹 표시만 빠진다
  delete from publishers where id = g;
  return n;
end $$;

revoke all on function public.cleanup_solo(uuid), public.outlet_make_solo(uuid), public.outlet_move(uuid, uuid), public.delete_group(uuid) from public, anon;
grant execute on function public.outlet_make_solo(uuid), public.outlet_move(uuid, uuid), public.delete_group(uuid) to authenticated;
