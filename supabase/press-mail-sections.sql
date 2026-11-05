-- 메일로 온 보도자료를 매체의 "섹션(분류)"별로 나눠 받기 (Supabase SQL 에디터에서 1회 실행. press-email-addon.sql 다음, 여러 번 실행해도 된다)
--   · 메일 제목·본문에 섹션별 키워드가 있으면 그 섹션으로, 어디에도 안 맞으면 "미분류"로 저장한다
--   · 섹션마다 하루 받을 건수(기본 5건)를 정한다. 섹션 한도를 넘는 메일은 받지 않는다 (받지 못한 건수에 합산)
--   · 매체 전체 하루 한도(press_mail_limit_of, 현재 100건)는 그대로 위에 걸린다
--   · 섹션 설정을 하지 않은 매체는 지금과 똑같이 동작한다 (분류도 섹션 한도도 없음)
--   · 설정은 outlets.site.mailSections 한 칸: {"sections":[{"name":"정치","keywords":["국회","대통령"],"limit":5}],"otherLimit":5}

alter table press_releases add column if not exists mail_section text;

-- 설정 저장 (편집장 이상). p_conf 가 null 이면 지운다
create or replace function public.outlet_mail_sections_save(o uuid, p_conf jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then
    raise exception '이 매체의 메일 분류를 고칠 권한이 없습니다. 편집장 이상만 고칠 수 있습니다.';
  end if;
  if p_conf is not null and (jsonb_typeof(p_conf) <> 'object' or jsonb_typeof(coalesce(p_conf->'sections', '[]'::jsonb)) <> 'array') then raise exception '잘못된 요청입니다.'; end if;
  if jsonb_array_length(coalesce(p_conf->'sections', '[]'::jsonb)) > 30 then raise exception '섹션은 30개까지입니다.'; end if;
  update outlets
     set site = case when p_conf is null then coalesce(site, '{}'::jsonb) - 'mailSections'
                     else jsonb_set(coalesce(site, '{}'::jsonb), '{mailSections}', p_conf, true) end
   where id = o;
  if not found then raise exception '매체를 찾지 못했습니다.'; end if;
end $$;
revoke all on function public.outlet_mail_sections_save(uuid, jsonb) from public, anon;
grant execute on function public.outlet_mail_sections_save(uuid, jsonb) to authenticated;

-- 오늘 섹션별로 받은 건수 (편집장 화면용)
create or replace function public.outlet_mail_section_usage(o uuid) returns table (section text, n int)
language plpgsql stable security definer set search_path = public as $$
declare day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if not (coalesce(public.is_outlet_editor(o), false) or coalesce(public.is_staff(), false)) then raise exception '권한이 없습니다.'; end if;
  return query select coalesce(r.mail_section, '')::text, count(*)::int from press_releases r
    where r.source_key = 'email' and r.fetched_at >= day_start and r.created_by in (select id from profiles where outlet_id = o)
    group by 1;
end $$;
revoke all on function public.outlet_mail_section_usage(uuid) from public, anon;
grant execute on function public.outlet_mail_section_usage(uuid) to authenticated;

-- 메일 받기: 위 설정이 있으면 분류 + 섹션별 하루 한도를 적용한다 (나머지는 press-email-addon.sql 과 같다)
create or replace function public.press_ingest_email(
  secret text, p_token text, p_kind text,
  p_verify_code text, p_verify_link text,
  p_source_name text, p_guid text, p_title text, p_summary text, p_body_html text, p_published_at timestamptz,
  p_attachments jsonb
) returns text language plpgsql security definer set search_path = public, private as $$
declare
  owner uuid;
  oid uuid;
  new_id uuid;
  a jsonb;
  scope text;
  g text;
  lim int;
  used int;
  trial boolean := false;
  conf jsonb;
  sec text := null;
  sec_lim int;
  sec_used int;
  hay text;
  s jsonb;
  kw text;
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
begin
  if secret is null or secret <> (select value from private.settings where key = 'press_mail_secret') then
    raise exception 'forbidden';
  end if;
  select user_id into owner from press_inboxes where token = lower(p_token);
  if owner is null then return 'unknown_inbox'; end if;

  if p_kind = 'verify' then
    update press_inboxes set verify_code = p_verify_code, verify_link = p_verify_link, verify_at = now() where token = lower(p_token);
    return 'verify_saved';
  end if;

  select outlet_id into oid from profiles where id = owner;
  if oid is not null and not public.press_mail_on(oid) then
    if (select press_mail_trial_used from outlets where id = oid) >= coalesce((select value::int from private.settings where key = 'press_mail_trial_limit'), 3) then
      update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
      insert into press_mail_drops (outlet_id, day, n) values (oid, (now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (outlet_id, day) do update set n = press_mail_drops.n + 1;
      return 'addon_required';
    end if;
    trial := true;
  end if;
  -- 매체 전체 하루 한도
  select public.press_mail_limit_of(oid) into lim;
  if oid is not null then
    select count(*) into used from press_releases r
      where r.source_key = 'email' and r.fetched_at >= day_start
        and r.created_by in (select id from profiles where outlet_id = oid);
  else
    select count(*) into used from press_releases r where r.source_key = 'email' and r.fetched_at >= day_start and r.created_by = owner;
  end if;
  if used >= lim then
    update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
    if oid is not null then
      insert into press_mail_drops (outlet_id, day, n) values (oid, (now() at time zone 'Asia/Seoul')::date, 1)
      on conflict (outlet_id, day) do update set n = press_mail_drops.n + 1;
    end if;
    return 'rate_limited';
  end if;

  -- 섹션 분류: 제목 → 본문 순으로 키워드가 들어 있는 첫 섹션, 없으면 "미분류"
  if oid is not null then
    select site->'mailSections' into conf from outlets where id = oid;
    if conf is not null and jsonb_typeof(conf->'sections') = 'array' and jsonb_array_length(conf->'sections') > 0 then
      hay := lower(coalesce(p_title, '') || ' ' || coalesce(p_summary, '') || ' ' || left(regexp_replace(coalesce(p_body_html, ''), '<[^>]+>', ' ', 'g'), 4000));
      for s in select * from jsonb_array_elements(conf->'sections') loop
        for kw in select jsonb_array_elements_text(coalesce(s->'keywords', '[]'::jsonb)) loop
          if length(trim(kw)) > 0 and position(lower(trim(kw)) in hay) > 0 then sec := s->>'name'; sec_lim := coalesce((s->>'limit')::int, 5); exit; end if;
        end loop;
        exit when sec is not null;
      end loop;
      if sec is null then sec := '미분류'; sec_lim := coalesce((conf->>'otherLimit')::int, 5); end if;
      select count(*) into sec_used from press_releases r
        where r.source_key = 'email' and r.fetched_at >= day_start and r.mail_section = sec
          and r.created_by in (select id from profiles where outlet_id = oid);
      if sec_used >= sec_lim then
        update press_inboxes set dropped_count = dropped_count + 1, last_dropped_at = now() where token = lower(p_token);
        insert into press_mail_drops (outlet_id, day, n) values (oid, (now() at time zone 'Asia/Seoul')::date, 1)
        on conflict (outlet_id, day) do update set n = press_mail_drops.n + 1;
        return 'rate_limited';
      end if;
    end if;
  end if;

  begin
    if to_regprocedure('public.profile_publisher(uuid)') is not null then
      execute 'select public.profile_publisher($1)::text' into scope using owner;
    end if;
  exception when others then scope := null;
  end;
  g := p_guid || ':' || coalesce(scope, owner::text);

  insert into press_releases (source_key, source_name, guid, title, link, summary, body_html, published_at, created_by, mail_section)
  values ('email', left(p_source_name, 80), g, left(p_title, 300), '', left(p_summary, 400), p_body_html, coalesce(p_published_at, now()), owner, sec)
  on conflict (guid) do nothing
  returning id into new_id;

  update press_inboxes set last_received_at = now(), received_count = received_count + 1 where token = lower(p_token);
  if new_id is null then return 'duplicate'; end if;
  if trial then update outlets set press_mail_trial_used = press_mail_trial_used + 1 where id = oid; end if;

  for a in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into press_attachments (press_release_id, name, content_type, size, data)
    values (new_id, left(a->>'name', 200), left(a->>'content_type', 100), (a->>'size')::int, decode(a->>'content', 'base64'));
  end loop;
  return 'saved';
end $$;
revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
