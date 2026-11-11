-- 자동 작성 "꼭 포함할 출처" (Supabase SQL 에디터에서 1회 실행. 여러 번 실행해도 된다)
--   · auto_press_outlets.required_groups: [{"name":"수원시","sources":["lg-suwon"]}, …]
--     하루 안에 이 묶음 각각에서 기사를 적어도 1건은 쓰고(그 묶음의 자료가 있을 때), 나머지 건수는 지역을 돌려 가며 쓴다
--   · auto_press_today_sources: 오늘(매체 현지 날짜) 자동 작성한 기사의 출처 목록 (꼭 포함할 출처를 이미 채웠는지 보려고)
alter table auto_press_outlets add column if not exists required_groups jsonb;

create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'publish_hour', c.publish_hour, 'byline', c.byline, 'author_id', c.author_id,
                              'require_words', to_jsonb(c.require_words), 'block_words', to_jsonb(c.block_words), 'trusted_sources', to_jsonb(c.trusted_sources), 'required_groups', c.required_groups),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $$;

create or replace function public.auto_press_today_sources(secret text, p_outlet uuid)
returns text[] language plpgsql security definer set search_path = public, private as $$
declare tzname text; out text[];
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select tz into tzname from auto_press_outlets where outlet_id = p_outlet;
  select coalesce(array_agg(distinct r.source_key), '{}') into out
    from articles a join press_releases r on r.id = a.press_release_id
   where a.outlet_id = p_outlet and a.auto_generated
     and (a.created_at at time zone coalesce(tzname, 'Asia/Seoul'))::date = (now() at time zone coalesce(tzname, 'Asia/Seoul'))::date;
  return out;
end $$;
revoke all on function public.auto_press_plan(text, uuid) from public;
revoke all on function public.auto_press_today_sources(text, uuid) from public;
grant execute on function public.auto_press_plan(text, uuid) to anon, authenticated;
grant execute on function public.auto_press_today_sources(text, uuid) to anon, authenticated;

-- 뉴스폭탄: 창원시·수원시·안성시·안성시의회·평택시·평택시의회는 매일 꼭 포함 (의회 출처는 수집 주소가 정해지면 같은 이름으로 추가한다)
update auto_press_outlets set required_groups = $j$[
  {"name":"창원특례시","sources":["lg-changwon"]},
  {"name":"수원시","sources":["lg-suwon"]},
  {"name":"안성시","sources":["lg-anseong"]},
  {"name":"안성시의회","sources":["lg-anseong-council"]},
  {"name":"평택시","sources":["lg-pyeongtaek"]},
  {"name":"평택시의회","sources":["lg-pyeongtaek-council"]}
]$j$::jsonb where outlet_id = (select id from outlets where name = '뉴스폭탄' limit 1);

-- 뉴스폭탄 맞춤 자료 1그룹에 창원특례시·안성시 출처를 담는다
update outlets set site = jsonb_set(site, '{pressTiers,0,sources}',
  (select coalesce(jsonb_agg(distinct x), '[]'::jsonb) from jsonb_array_elements_text((site #> '{pressTiers,0,sources}') || '["lg-changwon","lg-anseong"]'::jsonb) x))
where name = '뉴스폭탄' and jsonb_typeof(site #> '{pressTiers,0,sources}') = 'array';
