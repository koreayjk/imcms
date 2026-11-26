-- 자동 기사 지역 담당 기자 (여러 번 실행해도 안전하다)
--   auto_press_outlets.region_bylines: [{"byline":"기자 이름","sources":["출처 키",…],"keywords":["지역 낱말",…]}, …]
--   · 보도자료 출처가 sources 에 있으면 그 기자 이름으로 쓴다 (본문 첫머리 [매체=이름 기자] 와 articles.byline)
--   · 지자체 출처(lg-…)가 아닌 자료(메일·분야별)는 제목·요약에 keywords 낱말이 있을 때만
--   · 어디에도 안 맞으면 기존 byline(편집장) 그대로. 로그인 계정(author_id)은 바꾸지 않는다

alter table auto_press_outlets add column if not exists region_bylines jsonb;

create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'private'
as $function$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'publish_hour', c.publish_hour, 'byline', c.byline, 'author_id', c.author_id,
                              'require_words', to_jsonb(c.require_words), 'block_words', to_jsonb(c.block_words), 'trusted_sources', to_jsonb(c.trusted_sources), 'required_groups', c.required_groups, 'region_bylines', c.region_bylines),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $function$;

drop function if exists public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric, boolean);
create or replace function public.auto_press_save(secret text, p_outlet uuid, p_press uuid, p_category uuid, p_title text, p_body text, p_excerpt text, p_thumb text, p_tags text[], p_notes text, p_legal jsonb, p_cost numeric, p_hold boolean default false, p_byline text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'private'
as $function$
declare c auto_press_outlets; new_id uuid; pub timestamptz; auto_pub boolean;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select * into c from auto_press_outlets where outlet_id = p_outlet and enabled;
  if not found then raise exception 'outlet not enabled'; end if;
  if c.author_id is null then raise exception 'author missing for %', p_outlet; end if;
  if exists (select 1 from articles a where a.outlet_id = p_outlet and a.press_release_id = p_press) then return null; end if;
  auto_pub := c.publish_hour is not null and not coalesce(p_hold, false);
  if auto_pub then
    pub := (date_trunc('day', now() at time zone c.tz) + make_interval(hours => c.publish_hour)) at time zone c.tz;
    if pub < now() then pub := now(); end if;
  end if;
  insert into articles (outlet_id, category_id, author_id, title, body, excerpt, thumbnail_url, status, published_at, tags, byline, ai_notes,
                        press_release_id, legal_check, legal_checked_at, auto_generated)
  values (p_outlet, p_category, c.author_id, p_title, p_body, p_excerpt, p_thumb,
          case when auto_pub then 'published'::article_status else 'in_review'::article_status end, pub,
          p_tags, coalesce(nullif(trim(p_byline), ''), c.byline), p_notes, p_press, p_legal, now(), true)
  returning articles.id into new_id;
  insert into auto_press_log (outlet_id, press_release_id, article_id, ok, message, cost_usd)
  values (p_outlet, p_press, new_id, true, case when auto_pub then c.publish_hour || '시 발행 예약' else '승인 대기로 저장' end, p_cost);
  return new_id;
end $function$;

revoke all on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric, boolean, text) from public;
grant execute on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric, boolean, text) to anon, authenticated;

-- 뉴스폭탄: 인천·안산·화성 이문희 / 호남 김진하 / 제주 오지은 / 강원 이슬기 (나머지는 이호현)
update auto_press_outlets set region_bylines = $j$[
  {"byline":"이문희","sources":["lg-incheon","lg-namdong","lg-bupyeong","lg-michuhol","lg-seo-incheon","lg-ganghwa","lg-yeonsu","lg-ansan"],"keywords":["인천","안산","화성"]},
  {"byline":"김진하","sources":["lg-gwangsan","lg-mokpo","lg-naju","lg-muan"],"keywords":["호남","전남","전북","전라","광주광역시"]},
  {"byline":"오지은","sources":["lg-jeju"],"keywords":["제주"]},
  {"byline":"이슬기","sources":["lg-chuncheon","lg-wonju","lg-hoengseong","lg-yeongwol"],"keywords":["강원"]}
]$j$::jsonb
where outlet_id = (select id from outlets where name = '뉴스폭탄');

-- 보도자료함에서 기사를 만들 때(수동 AI 기사)도 지역 담당 기자를 쓰도록, 편집국 사람이 그 매체의 지역 기자 목록을 읽는 함수
--   (auto_press_outlets 는 정책이 없어 직접 읽을 수 없다). 그 매체를 볼 수 있는 사람만 읽는다
create or replace function public.outlet_region_bylines(p_outlet uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select c.region_bylines from auto_press_outlets c
  where c.outlet_id = p_outlet and public.can_view_outlet(p_outlet)
$$;
revoke all on function public.outlet_region_bylines(uuid) from public;
grant execute on function public.outlet_region_bylines(uuid) to authenticated;
