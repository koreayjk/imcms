-- 자동 기사 후보 읽기 속도 개선 + 사진 없는 자료도 후보로 허용(자동 작성이 스스로 사진을 찾음)
-- 1) 후보 쿼리가 시간 초과(statement timeout)로 실패하던 문제: 최근 자동 기사 목록을 한 번만 모아 두고 비교한다
-- 2) 맞춤 자료 매체의 후보에서 '사진 없음' 판정 자료를 빼지 않을 수 있게 p_photoless 추가 (뉴스폭탄은 false 유지)
-- 여러 번 실행해도 안전하다 (create or replace / drop if exists)

create or replace function public.auto_press_candidates(secret text, p_outlet uuid, p_days integer default 4, p_limit integer default 600, p_english boolean default null)
returns table(id uuid, source_key text, source_name text, title text, link text, summary text, body_html text, image_url text, published_at timestamptz)
language plpgsql security definer set search_path to 'public', 'private'
as $function$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    with ra as (
      select a2.press_release_id as rid, lower(p2.title) as t
      from articles a2 join press_releases p2 on p2.id = a2.press_release_id
      where a2.auto_generated and a2.created_at > now() - interval '7 days'
    ),
    mine as (select a.press_release_id as rid from articles a where a.outlet_id = p_outlet and a.press_release_id is not null),
    bad as (select l.press_release_id as rid from auto_press_log l where l.outlet_id = p_outlet and not l.ok and l.press_release_id is not null)
    select r.id, r.source_key, r.source_name, r.title, r.link, r.summary, r.body_html, r.image_url, r.published_at
    from press_releases r
    where coalesce(r.published_at, r.fetched_at) > now() - make_interval(days => p_days)
      and r.source_key not in ('manual', 'email')
      and (p_english is null or (p_english and r.source_key like 'us-%') or (not p_english and r.source_key not like 'us-%'))
      and r.id not in (select rid from mine)
      and r.id not in (select rid from bad)
      and r.id not in (select rid from ra where rid is not null)
      and lower(r.title) not in (select t from ra where t is not null)
    order by coalesce(r.published_at, r.fetched_at) desc
    limit p_limit;
end $function$;

drop function if exists public.auto_press_candidates_tiered(text, uuid, integer, integer);

create or replace function public.auto_press_candidates_tiered(secret text, p_outlet uuid, p_days integer default 4, p_limit integer default 800, p_photoless boolean default false)
returns table(id uuid, source_key text, source_name text, title text, link text, summary text, body_html text, image_url text, published_at timestamptz)
language plpgsql security definer set search_path to 'public', 'private'
as $function$
declare tiers jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select coalesce(o.site->'pressTiers', '[]'::jsonb) into tiers from outlets o where o.id = p_outlet;
  return query
    with ra as (
      select a2.press_release_id as rid, lower(p2.title) as t
      from articles a2 join press_releases p2 on p2.id = a2.press_release_id
      where a2.auto_generated and a2.outlet_id = p_outlet and a2.created_at > now() - interval '7 days'
    ),
    mine as (select a.press_release_id as rid from articles a where a.outlet_id = p_outlet and a.press_release_id is not null),
    bad as (select l.press_release_id as rid from auto_press_log l where l.outlet_id = p_outlet and not l.ok and l.press_release_id is not null),
    hid as (select h.press_release_id as rid from press_hidden h where h.outlet_id = p_outlet)
    select r.id, r.source_key, r.source_name, r.title, r.link, r.summary, r.body_html, r.image_url, r.published_at
    from press_releases r
    where coalesce(r.published_at, r.fetched_at) > now() - make_interval(days => p_days)
      and (r.quality = 'ok' or (p_photoless and r.quality = 'poor' and coalesce(r.quality_note, '') like '사진%'))
      and r.source_key not in ('manual', 'email')
      and (
        r.source_key in (select jsonb_array_elements_text(t->'sources') from jsonb_array_elements(tiers) t)
        or (r.source_key like 'nw-%' and exists (
              select 1 from jsonb_array_elements(tiers) t, jsonb_array_elements_text(t->'keywords') k
              where r.title ilike '%' || k || '%' or coalesce(r.summary, '') ilike '%' || k || '%'))
      )
      and r.id not in (select rid from hid)
      and r.id not in (select rid from mine)
      and r.id not in (select rid from bad)
      and r.id not in (select rid from ra where rid is not null)
      and lower(r.title) not in (select t from ra where t is not null)
    order by coalesce(r.published_at, r.fetched_at) desc
    limit p_limit;
end $function$;
