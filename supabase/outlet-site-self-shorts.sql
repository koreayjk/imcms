-- 편집장이 설정 → 매체 정보에서 쇼츠 구역(shorts)도 직접 저장할 수 있게 허용 목록에 한 칸을 더한다 (운영 DB에는 이미 적용됨. socials 포함)
--   화면에서 비운 값은 지워지므로, 이 함수를 부르는 곳은 socials 를 항상 함께 보내야 한다 (app/(main)/admin/settings/site-actions.ts)
create or replace function public.outlet_site_self_save(o uuid, p_name text, p_patch jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  allowed text[] := array['nameEn', 'slogan', 'sloganEn', 'description', 'logoUrl', 'logoMode', 'logoSize', 'colors', 'legal', 'aiNotice', 'pressForeignTopics', 'pressForeign', 'logoStrip', 'iconUrl', 'ogImage', 'cmsLang', 'commentsOn', 'commentsMode', 'commentsKind', 'thumbFill', 'pressKeywords', 'pressFields', 'socials', 'shorts'];
  k text;
  cur jsonb;
  found_row boolean;
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 매체의 정보를 고칠 권한이 없습니다. 편집장 이상만 고칠 수 있습니다.';
  end if;
  select coalesce(site, '{}'::jsonb), true into cur, found_row from outlets where id = o;
  if found_row is null then raise exception '매체를 찾지 못했습니다.'; end if;
  if jsonb_typeof(coalesce(p_patch, '{}'::jsonb)) <> 'object' then raise exception '잘못된 요청입니다.'; end if;
  foreach k in array allowed loop
    if p_patch ? k and jsonb_typeof(p_patch -> k) <> 'null' then
      cur := jsonb_set(cur, array[k], p_patch -> k, true);
    else
      cur := cur - k;   -- 화면에서 비운 값은 지운다 (기본값으로 돌아간다)
    end if;
  end loop;
  update outlets set name = coalesce(nullif(left(trim(p_name), 80), ''), name), site = cur where id = o;
end $function$;
