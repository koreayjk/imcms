-- 보도자료 → AI 기사 → 법적 검수 → 승인 대기 자동 작성 (Supabase SQL 에디터에서 1회 실행, press-cron.sql 다음)
-- 매시간 정각에 매체마다 /api/cron/auto-articles 를 한 번씩 부르고, 서버가 매체의 현지 시간이
-- 정해 둔 시간대(기본: 미국 중부 0~8시)이고 오늘 5건을 채우지 않았을 때만 기사 1건을 만든다.
-- 만든 기사는 항상 '승인 대기(in_review)'. 여러 번 실행해도 된다.

-- 1) 매체별 설정 (사용·하루 건수·시간대·기자명)
create table if not exists auto_press_outlets (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  enabled boolean not null default true,
  daily_limit int not null default 5,
  tz text not null default 'America/Chicago',
  start_hour int not null default 0,   -- 현지 시각 이 시(포함)부터
  end_hour int not null default 8,     -- 현지 시각 이 시(포함)까지
  byline text not null,
  author_id uuid references profiles(id) on delete set null,
  updated_at timestamptz default now()
);
alter table auto_press_outlets enable row level security;  -- 정책 없음: 아래 함수로만 접근

-- 2) 작업 기록 (성공·건너뜀·실패 이유)
create table if not exists auto_press_log (
  id bigserial primary key,
  outlet_id uuid references outlets(id) on delete cascade,
  press_release_id uuid references press_releases(id) on delete set null,
  article_id uuid references articles(id) on delete set null,
  ok boolean not null,
  message text,
  cost_usd numeric(10,5),
  created_at timestamptz default now()
);
create index if not exists auto_press_log_outlet_idx on auto_press_log (outlet_id, created_at desc);
alter table auto_press_log enable row level security;
-- 정책 없음: 기록은 SQL 에디터(총관리자)로만 본다

alter table articles add column if not exists auto_generated boolean not null default false;

-- 3) 대상 8개 매체 (이름으로 찾는다. 이미 있으면 건드리지 않는다)
insert into auto_press_outlets (outlet_id, byline, author_id)
select o.id, v.byline,
  coalesce(
    (select p.id from profiles p where p.full_name = v.byline order by (p.outlet_id = o.id) desc nulls last, p.created_at limit 1),
    (select a.author_id from articles a where a.outlet_id = o.id and a.byline = v.byline limit 1)
  )
from outlets o
join (values
  ('에듀와이드', 'Rebecca Hyun'),
  ('다음세대타임즈', '성수련'),
  ('The Statecraft Times', 'Ruti'),
  ('치앙마이미션타임즈', 'Sarah Sorna'),
  ('치앙마이 타임즈', 'Sarah Sorna'),
  ('Breaking BCS', 'John Lee'),
  ('말레이시아 타임즈', 'Johan'),
  ('Shipping Times', '관리자')
) as v(name, byline) on o.name = v.name
on conflict (outlet_id) do nothing;

-- 4) 크론이 쓰는 함수들 (press_cron_secret 이 맞을 때만 동작)
create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'byline', c.byline, 'author_id', c.author_id),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $$;

-- 이 매체가 아직 기사로 쓰지 않은 최근 보도자료
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
    order by coalesce(r.published_at, r.fetched_at) desc
    limit p_limit;
end $$;

-- 전문을 읽어 온 보도자료는 저장해 둔다
create or replace function public.auto_press_cache_body(secret text, p_id uuid, p_html text, p_image text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  update press_releases set body_html = p_html, image_url = p_image where press_releases.id = p_id;
end $$;

-- 기사 저장 (항상 승인 대기)
create or replace function public.auto_press_save(
  secret text, p_outlet uuid, p_press uuid, p_category uuid, p_title text, p_body text, p_excerpt text,
  p_thumb text, p_tags text[], p_notes text, p_legal jsonb, p_cost numeric)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare c auto_press_outlets; new_id uuid;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select * into c from auto_press_outlets where outlet_id = p_outlet and enabled;
  if not found then raise exception 'outlet not enabled'; end if;
  if c.author_id is null then raise exception 'author missing for %', p_outlet; end if;
  if exists (select 1 from articles a where a.outlet_id = p_outlet and a.press_release_id = p_press) then return null; end if;
  insert into articles (outlet_id, category_id, author_id, title, body, excerpt, thumbnail_url, status, tags, byline, ai_notes,
                        press_release_id, legal_check, legal_checked_at, auto_generated)
  values (p_outlet, p_category, c.author_id, p_title, p_body, p_excerpt, p_thumb, 'in_review', p_tags, c.byline, p_notes,
          p_press, p_legal, now(), true)
  returning articles.id into new_id;
  insert into auto_press_log (outlet_id, press_release_id, article_id, ok, message, cost_usd) values (p_outlet, p_press, new_id, true, '승인 대기로 저장', p_cost);
  return new_id;
end $$;

create or replace function public.auto_press_note(secret text, p_outlet uuid, p_press uuid, p_ok boolean, p_message text, p_cost numeric default null)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into auto_press_log (outlet_id, press_release_id, ok, message, cost_usd) values (p_outlet, p_press, p_ok, left(p_message, 500), p_cost);
end $$;

revoke all on function public.auto_press_plan(text, uuid) from public;
revoke all on function public.auto_press_candidates(text, uuid, int, int) from public;
revoke all on function public.auto_press_cache_body(text, uuid, text, text) from public;
revoke all on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric) from public;
revoke all on function public.auto_press_note(text, uuid, uuid, boolean, text, numeric) from public;
grant execute on function public.auto_press_plan(text, uuid) to anon, authenticated;
grant execute on function public.auto_press_candidates(text, uuid, int, int) to anon, authenticated;
grant execute on function public.auto_press_cache_body(text, uuid, text, text) to anon, authenticated;
grant execute on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric) to anon, authenticated;
grant execute on function public.auto_press_note(text, uuid, uuid, boolean, text, numeric) to anon, authenticated;

-- 5) 매시간 정각에 켜진 매체마다 서버를 깨운다 (실제로 쓸지는 서버가 현지 시간·오늘 건수로 정한다)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'auto-press-articles',
  '0 * * * *',
  $$
  select net.http_get(
    url := 'https://imcms.vercel.app/api/cron/auto-articles?outlet=' || c.outlet_id::text,
    headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
    timeout_milliseconds := 60000
  )
  from auto_press_outlets c where c.enabled;
  $$
);

-- 확인
select o.name, c.byline, c.tz, c.start_hour, c.end_hour, c.daily_limit, c.author_id is not null as author_ok, c.enabled
from auto_press_outlets c join outlets o on o.id = c.outlet_id order by o.name;
-- 끄려면: update auto_press_outlets set enabled = false where outlet_id = '...';  전체 중지: select cron.unschedule('auto-press-articles');
-- 최근 기록: select o.name, l.ok, l.message, l.cost_usd, l.created_at from auto_press_log l join outlets o on o.id = l.outlet_id order by l.created_at desc limit 30;
