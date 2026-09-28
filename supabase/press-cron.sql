-- 보도자료 자동 수집(30분마다) + 직접 등록 (Supabase SQL 에디터에서 1회 실행, press-releases.sql 다음)
-- 비밀 열쇠는 이 SQL이 DB 안에서 직접 만들고, 밖으로 나가지 않는다. Vercel에 따로 넣을 값은 없다.

-- 1) 직접 등록한 사람 기록 + 본인이 올린 것만 삭제 가능
alter table press_releases add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;
drop policy if exists "press_releases_delete_own" on press_releases;
create policy "press_releases_delete_own" on press_releases for delete to authenticated
  using (source_key = 'manual' and created_by = auth.uid());

-- 2) 예약 수집용 비밀 열쇠 (API로는 보이지 않는 private 스키마에 보관)
create schema if not exists private;
revoke all on schema private from anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);
insert into private.settings (key, value)
values ('press_cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- 3) 로그인 없이 부르는 수집 서버가 쓰는 함수 (열쇠가 맞을 때만 동작)
create or replace function public.press_cron_check(secret text)
returns boolean language sql security definer set search_path = public, private stable as $$
  select coalesce(secret = (select value from private.settings where key = 'press_cron_secret'), false);
$$;

create or replace function public.press_ingest(secret text, p_source_key text, p_ok boolean, p_message text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public, private as $$
declare n int := 0;
begin
  if not public.press_cron_check(secret) then
    raise exception 'forbidden';
  end if;
  if p_rows is not null and jsonb_array_length(p_rows) > 0 then
    insert into press_releases (source_key, source_name, guid, title, link, summary, body_html, published_at, created_by)
    select r.source_key, r.source_name, r.guid, r.title, r.link, r.summary, r.body_html, r.published_at, null
    from jsonb_to_recordset(p_rows) as r(source_key text, source_name text, guid text, title text, link text, summary text, body_html text, published_at timestamptz)
    on conflict (guid) do nothing;
    get diagnostics n = row_count;
  end if;
  insert into press_fetch_log (source_key, fetched_at, ok, message, item_count)
  values (p_source_key, now(), p_ok, p_message, case when p_ok then coalesce(jsonb_array_length(p_rows), 0) else 0 end)
  on conflict (source_key) do update
    set fetched_at = excluded.fetched_at, ok = excluded.ok, message = excluded.message, item_count = excluded.item_count;
  return n;
end $$;

revoke all on function public.press_cron_check(text) from public;
revoke all on function public.press_ingest(text, text, boolean, text, jsonb) from public;
grant execute on function public.press_cron_check(text) to anon, authenticated;
grant execute on function public.press_ingest(text, text, boolean, text, jsonb) to anon, authenticated;

-- 4) 30분마다 수집 서버를 깨운다 (Supabase 예약 작업)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'press-collect',
  '*/30 * * * *',
  $$
  select net.http_get(
    url := 'https://imcms.vercel.app/api/cron/press',
    headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
    timeout_milliseconds := 60000
  );
  $$
);

-- 5) 매일 새벽 4시(한국), 90일 지난 자동 수집 보도자료 중 기사로 쓰지 않은 것은 정리
select cron.schedule(
  'press-cleanup',
  '0 19 * * *',
  $$
  delete from press_releases p
  where p.source_key <> 'manual'
    and p.fetched_at < now() - interval '90 days'
    and not exists (select 1 from articles a where a.press_release_id = p.id);
  $$
);

-- 확인: select jobname, schedule, active from cron.job;
-- 최근 실행: select status_code, created from net._http_response order by created desc limit 5;
