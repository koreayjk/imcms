-- 보도자료함 "맞춤 자료"의 그룹(1~4단계) 설정: 편집장 이상이 보도자료함에서 직접 저장한다 (Supabase SQL 에디터에서 1회 실행. 여러 번 실행해도 된다)
--   · 매체 설정(outlets.site)의 pressTiers 한 칸만 바꾼다. 기존 설정 저장(outlet_site_self_save)은 이 칸을 건드리지 않는다
--   · p_tiers 가 null 이면 그룹 설정을 지운다 (예전 추천 방식으로 돌아간다)
create or replace function public.outlet_press_tiers_save(o uuid, p_tiers jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 매체의 보도자료 맞춤 설정을 고칠 권한이 없습니다. 편집장 이상만 고칠 수 있습니다.';
  end if;
  if p_tiers is not null and jsonb_typeof(p_tiers) <> 'array' then raise exception '잘못된 요청입니다.'; end if;
  if jsonb_array_length(coalesce(p_tiers, '[]'::jsonb)) > 4 then raise exception '그룹은 4개까지입니다.'; end if;
  update outlets
     set site = case when p_tiers is null then coalesce(site, '{}'::jsonb) - 'pressTiers'
                     else jsonb_set(coalesce(site, '{}'::jsonb), '{pressTiers}', p_tiers, true) end
   where id = o;
  if not found then raise exception '매체를 찾지 못했습니다.'; end if;
end $$;
revoke all on function public.outlet_press_tiers_save(uuid, jsonb) from public, anon;
grant execute on function public.outlet_press_tiers_save(uuid, jsonb) to authenticated;
