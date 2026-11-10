-- 자동 작성 기사를 승인 없이 정해 둔 시각에 발행하기 (Supabase SQL 에디터에서 1회 실행. 여러 번 실행해도 된다)
--   · auto_press_outlets.publish_hour: 비우면 지금처럼 "승인 대기". 0~23이면 그 시각(매체 현지 시각)에 발행되도록 예약해서 저장한다
--     (기사는 status = 'published' + 공개 시각 = 오늘 그 시각. 공개 시각 전에는 홈페이지에 보이지 않고 기사목록에는 "예약"으로 보인다.
--      이미 그 시각이 지났으면 바로 발행)
--   · 앱이 AI 법적 검수를 못 했거나 위험도가 "높음"이면 p_hold=true 로 보내 승인 대기로 둔다
--   · 켜기:  update auto_press_outlets set publish_hour = 7 where outlet_id = (select id from outlets where name = '뉴스폭탄');
--   · 끄기:  update auto_press_outlets set publish_hour = null where outlet_id = (select id from outlets where name = '뉴스폭탄');
alter table auto_press_outlets add column if not exists publish_hour int check (publish_hour between 0 and 23);

create or replace function public.auto_press_plan(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare r jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'outlet', jsonb_build_object('id', o.id, 'name', o.name, 'domain', o.domain, 'site', o.site, 'created_at', o.created_at),
    'cfg', jsonb_build_object('enabled', c.enabled, 'daily_limit', c.daily_limit, 'tz', c.tz, 'start_hour', c.start_hour, 'end_hour', c.end_hour, 'publish_hour', c.publish_hour, 'byline', c.byline, 'author_id', c.author_id,
                              'require_words', to_jsonb(c.require_words), 'block_words', to_jsonb(c.block_words), 'trusted_sources', to_jsonb(c.trusted_sources)),
    'today', (select count(*) from articles a where a.outlet_id = o.id and a.auto_generated
              and (a.created_at at time zone c.tz)::date = (now() at time zone c.tz)::date),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'slug', k.slug, 'name', k.name) order by k.sort_order) from categories k where k.outlet_id = o.id), '[]'::jsonb)
  ) into r
  from outlets o join auto_press_outlets c on c.outlet_id = o.id
  where o.id = p_outlet;
  return r;
end $$;

-- 예전 함수(인자 12개)를 지우고 p_hold 가 있는 새 함수로 바꾼다 (p_hold 를 안 보내도 동작)
drop function if exists public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric);
create or replace function public.auto_press_save(
  secret text, p_outlet uuid, p_press uuid, p_category uuid, p_title text, p_body text, p_excerpt text, p_thumb text,
  p_tags text[], p_notes text, p_legal jsonb, p_cost numeric, p_hold boolean default false
) returns uuid language plpgsql security definer set search_path = public, private as $$
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
          p_tags, c.byline, p_notes, p_press, p_legal, now(), true)
  returning articles.id into new_id;
  insert into auto_press_log (outlet_id, press_release_id, article_id, ok, message, cost_usd)
  values (p_outlet, p_press, new_id, true, case when auto_pub then c.publish_hour || '시 발행 예약' else '승인 대기로 저장' end, p_cost);
  return new_id;
end $$;
revoke all on function public.auto_press_plan(text, uuid) from public;
revoke all on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric, boolean) from public;
grant execute on function public.auto_press_plan(text, uuid) to anon, authenticated;
grant execute on function public.auto_press_save(text, uuid, uuid, uuid, text, text, text, text, text[], text, jsonb, numeric, boolean) to anon, authenticated;

-- 뉴스폭탄: 매일 아침 7시에 발행 (승인 없이)
update auto_press_outlets set publish_hour = 7 where outlet_id = (select id from outlets where name = '뉴스폭탄' limit 1);
