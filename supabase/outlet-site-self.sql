-- 편집장 이상이 편집국 "설정"에서 직접 고치는 매체 정보 (Supabase SQL 에디터에서 1회 실행. outlet-sites.sql·groups.sql 다음, 여러 번 실행해도 된다)
--   · 편집국 언어(cmsLang: ko/en), 매체 이름, 영문 이름·슬로건·소개, 로고, 탭 아이콘, 공유 미리보기 사진, 색, 하단 표시 정보, AI 활용 표시, 해외 언론 자료 받기, 홈페이지 아래 로고 띠만 고칠 수 있다
--   · 도메인·검색 노출·AI 봇·소유 확인 코드·오픈 준비 중 스위치·홈 배치 등은 그대로 운영팀만 바꾼다 (이 함수는 아래 목록 밖의 값은 건드리지 않는다)
--   · 매체 수정 권한(outlets_update)은 그대로 총관리자 전용이고, 이 함수만 편집장·발행인·운영팀에게 위 항목에 한해 열어 준다
create or replace function public.outlet_site_self_save(o uuid, p_name text, p_patch jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['nameEn', 'slogan', 'sloganEn', 'description', 'logoUrl', 'logoMode', 'logoSize', 'colors', 'legal', 'aiNotice', 'pressForeignTopics', 'pressForeign', 'logoStrip', 'iconUrl', 'ogImage', 'cmsLang'];
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
end $$;
revoke all on function public.outlet_site_self_save(uuid, text, jsonb) from public, anon;
grant execute on function public.outlet_site_self_save(uuid, text, jsonb) to authenticated;
