-- 보도자료함 "전체" 탭에서 편집장이 출처를 골라 추천에 넣는 기능 (Supabase SQL 에디터에서 1회 실행. outlet-site-self.sql 다음, 여러 번 실행해도 된다)
--   · outlets.site 의 pressSources(출처 key 배열)만 바꾼다. 다른 설정은 건드리지 않는다.
--   · 편집장 이상(또는 운영팀)만 실행할 수 있다.
create or replace function public.outlet_press_sources_save(o uuid, p_sources text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  cur jsonb;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 매체의 추천 출처를 고칠 권한이 없습니다. 편집장 이상만 고칠 수 있습니다.';
  end if;
  select coalesce(site, '{}'::jsonb) into cur from outlets where id = o;
  if not found then raise exception '매체를 찾지 못했습니다.'; end if;
  if coalesce(array_length(p_sources, 1), 0) > 80 then raise exception '너무 많이 골랐습니다.'; end if;
  if coalesce(array_length(p_sources, 1), 0) = 0 then
    cur := cur - 'pressSources';
  else
    cur := jsonb_set(cur, array['pressSources'], to_jsonb(p_sources), true);
  end if;
  update outlets set site = cur where id = o;
end $$;
revoke all on function public.outlet_press_sources_save(uuid, text[]) from public, anon;
grant execute on function public.outlet_press_sources_save(uuid, text[]) to authenticated;
