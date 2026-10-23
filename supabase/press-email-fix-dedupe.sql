-- 메일로 받은 보도자료: 다른 고객(그룹)에게 같은 자료가 오면 한쪽이 '중복'으로 버려지던 문제 고침
--   (Supabase SQL 에디터에서 1회 실행. press-email.sql 이 이미 실행된 곳에서 함수만 바꾼다)
--   같은 그룹 안에서는 전과 같이 하나로 합치고, 그룹이 다르면 각자 보도자료함에 따로 들어온다

-- 6) 메일 수신 서비스 → IM 뉴스룸: 확인 메일은 기자 설정 화면에, 보도자료는 보도자료함에
create or replace function public.press_ingest_email(
  secret text, p_token text, p_kind text,
  p_verify_code text, p_verify_link text,
  p_source_name text, p_guid text, p_title text, p_summary text, p_body_html text, p_published_at timestamptz,
  p_attachments jsonb
) returns text language plpgsql security definer set search_path = public, private as $$
declare
  owner uuid;
  new_id uuid;
  a jsonb;
  scope text;
  g text;
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

  -- 같은 자료가 같은 그룹 기자 여러 명에게 오면 하나로, 다른 고객 그룹에는 각자 따로 들어가게 (guid 는 전체에서 하나뿐이라 그룹을 붙인다)
  begin
    if to_regprocedure('public.profile_publisher(uuid)') is not null then
      execute 'select public.profile_publisher($1)::text' into scope using owner;
    end if;
  exception when others then scope := null;
  end;
  g := p_guid || ':' || coalesce(scope, owner::text);

  insert into press_releases (source_key, source_name, guid, title, link, summary, body_html, published_at, created_by)
  values ('email', left(p_source_name, 80), g, left(p_title, 300), '', left(p_summary, 400), p_body_html, coalesce(p_published_at, now()), owner)
  on conflict (guid) do nothing
  returning id into new_id;

  update press_inboxes set last_received_at = now(), received_count = received_count + 1 where token = lower(p_token);
  if new_id is null then return 'duplicate'; end if;

  for a in select * from jsonb_array_elements(coalesce(p_attachments, '[]'::jsonb)) loop
    insert into press_attachments (press_release_id, name, content_type, size, data)
    values (new_id, left(a->>'name', 200), left(a->>'content_type', 100), (a->>'size')::int, decode(a->>'content', 'base64'));
  end loop;
  return 'saved';
end $$;

revoke all on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) from public;
grant execute on function public.press_ingest_email(text, text, text, text, text, text, text, text, text, text, timestamptz, jsonb) to anon, authenticated;
