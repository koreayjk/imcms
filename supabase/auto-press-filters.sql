-- 자동 기사 정확도 개선: 매체별 필수·제외 단어, 다른 매체와의 중복 방지 (auto-press-articles.sql 다음에 실행, 여러 번 실행해도 됨)
--   require_words: 제목·요약에 이 중 하나는 있어야 기사로 쓴다 (비어 있으면 제한 없음)
--   block_words:   하나라도 있으면 쓰지 않는다
-- 단어는 소문자 부분 일치로 비교한다. 바꾸고 싶으면 아래 update 의 목록만 고쳐 다시 실행한다.

alter table auto_press_outlets add column if not exists require_words text[] not null default '{}';
alter table auto_press_outlets add column if not exists block_words text[] not null default '{}';

update auto_press_outlets c set require_words = v.req, block_words = v.blk
from outlets o, (values
  ('Breaking BCS',
   array['bryan','college station','brazos','texas a&m','aggie','tamu','kyle field','easterwood','research valley','blinn','navasota','burleson county','madison county','csisd','reed arena','blue bell park'],
   array[]::text[]),
  ('The Statecraft Times',
   array['diplomacy','diplomat','foreign policy','foreign minister','secretary of state','ambassador','embassy','summit','sanction','tariff','trade deal','trade agreement','nato','united nations','security council','ceasefire','peace talks','treaty','defense minister','defence','military','missile','nuclear','intelligence','espionage','ukraine','russia','china','taiwan','north korea','south korea','iran','israel','gaza','g7','g20','asean','apec','imf','world bank'],
   array[]::text[]),
  ('치앙마이 타임즈',
   array['business','invest','econom','trade','tourism','tourist','visa','baht','boi','export','import','tax','airport','airline','flight','property','real estate','startup','industry','bank','energy','tariff','chiang mai','northern thailand','digital','manufactur','agricultur','hotel','retail','currency','gdp','inflation','agreement','mou'],
   array['crash','killed','murder','arrest','assault','stab','shooting','shot dead','body found','dead','death','drug','idol','accident','fire alarm','scam','gang','police','court']),
  ('치앙마이미션타임즈',
   array['mission','church','christian','gospel','bible','pastor','missionary','evangel','persecut','chiang mai','선교','교회','기독','목사','성도','복음','성경'],
   array[]::text[]),
  ('말레이시아 타임즈',
   array['ringgit','invest','mida','miti','econom','trade','export','import','education','student','universit','school','college','teacher','curriculum','visa','tourism','tourist','halal','semiconductor','palm oil','business','bank','tax','gdp','inflation','industry','manufactur','digital','data cent','startup','korea','tvet','scholarship','mohe'],
   array['motogp','football','badminton','murder','killed','crash','arrest','celebrity','entertain','sultan','agong','court','police','scam']),
  ('다음세대타임즈',
   array['교육','학교','학생','청소년','청년','다음세대','교회학교','주일학교','성경','신앙','부모','자녀','교사','가정','대안학교','홈스쿨','교리','개혁','school','student','children','youth','family','education','curriculum'],
   array[]::text[])
) as v(name, req, blk)
where o.id = c.outlet_id and o.name = v.name;

-- 계획 읽기: 필수·제외 단어도 함께 돌려준다
create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'byline', c.byline, 'author_id', c.author_id,
                              'require_words', to_jsonb(c.require_words), 'block_words', to_jsonb(c.block_words)),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $$;

-- 후보: 7일 안에 어느 매체든 자동으로 쓴 보도자료(같은 것 또는 같은 제목)는 뺀다
create or replace function public.auto_press_candidates(secret text, p_outlet uuid, p_days int default 4, p_limit int default 400)
returns table (id uuid, source_key text, source_name text, title text, link text, summary text, body_html text, image_url text, published_at timestamptz)
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    select r.id, r.source_key, r.source_name, r.title, r.link, r.summary, r.body_html, r.image_url, r.published_at
    from press_releases r
    where coalesce(r.published_at, r.fetched_at) > now() - make_interval(days => p_days)
      and r.source_key not in ('manual', 'email')
      and not exists (select 1 from articles a where a.outlet_id = p_outlet and a.press_release_id = r.id)
      and not exists (select 1 from auto_press_log l where l.outlet_id = p_outlet and l.press_release_id = r.id and not l.ok)
      and not exists (select 1 from articles a2 join press_releases p2 on p2.id = a2.press_release_id
                      where a2.auto_generated and a2.created_at > now() - interval '7 days'
                        and (a2.press_release_id = r.id or lower(p2.title) = lower(r.title)))
    order by coalesce(r.published_at, r.fetched_at) desc
    limit p_limit;
end $$;

-- 최근 자동 기사의 원본 제목 (비슷한 사건 중복을 서버가 걸러 내는 데 쓴다)
create or replace function public.auto_press_recent_titles(secret text, p_days int default 3)
returns table (title text)
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    select p.title from articles a join press_releases p on p.id = a.press_release_id
    where a.auto_generated and a.created_at > now() - make_interval(days => p_days);
end $$;

revoke all on function public.auto_press_recent_titles(text, int) from public;
grant execute on function public.auto_press_recent_titles(text, int) to anon, authenticated;

select o.name, cardinality(c.require_words) req, cardinality(c.block_words) blk
from auto_press_outlets c join outlets o on o.id = c.outlet_id order by o.name;

-- 지역 공식 출처는 필수 단어 검사를 면제한다 (Breaking BCS: 시청·대학·도서관 소식은 제목에 지역 이름이 없어도 지역 소식)
alter table auto_press_outlets add column if not exists trusted_sources text[] not null default '{}';
update auto_press_outlets c set trusted_sources = array['us-cstx-news','us-bryan-news','us-agrilife','us-bcslibrary','us-tamu-today']
from outlets o where o.id = c.outlet_id and o.name = 'Breaking BCS';

create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'byline', c.byline, 'author_id', c.author_id,
                              'require_words', to_jsonb(c.require_words), 'block_words', to_jsonb(c.block_words), 'trusted_sources', to_jsonb(c.trusted_sources)),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $$;
