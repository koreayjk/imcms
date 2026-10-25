-- 광고 자리 늘리기·켜고 끄기 (Supabase SQL 에디터에서 1회 실행. ad-banners.sql 다음, 여러 번 실행해도 된다)
--   · 새 자리 2곳: 홈 맨 아래(home_bottom), 기사 위(article_top)
--   · 편집장 이상이 광고 화면에서 자리를 끄고, 오른쪽 광고 개수를 정한다 (매체 설정 site.adSlots 에 저장)

-- 1) 배너가 걸릴 수 있는 자리 목록에 새 자리 추가
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.ad_banners'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%slot%in%' loop
    execute format('alter table public.ad_banners drop constraint %I', c.conname);
  end loop;
  alter table public.ad_banners add constraint ad_banners_slot_check
    check (slot in ('header', 'sidebar', 'home_middle', 'home_bottom', 'article_top', 'article_bottom', 'popup'));
end $$;

-- 2) 편집장·발행인·운영팀이 자기 매체의 광고 자리 설정만 고친다 (매체의 다른 설정은 건드리지 않는다)
create or replace function public.outlet_ad_slots_save(o uuid, p_ad jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare cur jsonb; found_row boolean;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 매체의 광고 자리를 고칠 권한이 없습니다. 편집장 이상만 고칠 수 있습니다.';
  end if;
  select coalesce(site, '{}'::jsonb), true into cur, found_row from outlets where id = o;
  if found_row is null then raise exception '매체를 찾지 못했습니다.'; end if;
  if p_ad is null or jsonb_typeof(p_ad) <> 'object' or p_ad = '{}'::jsonb then
    cur := cur - 'adSlots';
  else
    cur := jsonb_set(cur, '{adSlots}', p_ad, true);
  end if;
  update outlets set site = cur where id = o;
end $$;
revoke all on function public.outlet_ad_slots_save(uuid, jsonb) from public, anon;
grant execute on function public.outlet_ad_slots_save(uuid, jsonb) to authenticated;
