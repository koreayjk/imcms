-- 맞춤 자료(그룹)를 쓰는 매체의 자동 작성 (운영 DB에는 이미 적용됨. 여러 번 실행해도 된다)
--   · auto_press_candidates_tiered: 품질 ok · 맞춤 자료(그룹의 출처, 또는 그룹 키워드가 제목·요약에 있는 뉴스와이어)에 걸리는 · 가리지 않은 · 아직 기사로 안 쓴 보도자료
--   · auto_press_ai_left / auto_press_ai_count: 이 매체의 이번 달 AI 한도를 확인하고, 자동 작성 기사 1건을 한도에 1회로 센다 (맞춤 자료 매체만)
--   · 서버(lib/auto-press.ts rankTiered)가 지역(광역)별로 번갈아 골라 쓴다. 기존 auto_press_* 함수는 그대로다.
create or replace function public.auto_press_candidates_tiered(secret text, p_outlet uuid, p_days integer default 4, p_limit integer default 800)
returns table(id uuid, source_key text, source_name text, title text, link text, summary text, body_html text, image_url text, published_at timestamptz)
language plpgsql security definer set search_path = public, private as $$
declare tiers jsonb;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  select coalesce(o.site->'pressTiers', '[]'::jsonb) into tiers from outlets o where o.id = p_outlet;
  return query
    select r.id, r.source_key, r.source_name, r.title, r.link, r.summary, r.body_html, r.image_url, r.published_at
    from press_releases r
    where coalesce(r.published_at, r.fetched_at) > now() - make_interval(days => p_days)
      and r.quality = 'ok'
      and r.source_key not in ('manual', 'email')
      and (
        r.source_key in (select jsonb_array_elements_text(t->'sources') from jsonb_array_elements(tiers) t)
        or (r.source_key like 'nw-%' and exists (
              select 1 from jsonb_array_elements(tiers) t, jsonb_array_elements_text(t->'keywords') k
              where r.title ilike '%' || k || '%' or coalesce(r.summary, '') ilike '%' || k || '%'))
      )
      and not exists (select 1 from press_hidden h where h.outlet_id = p_outlet and h.press_release_id = r.id)
      and not exists (select 1 from articles a where a.outlet_id = p_outlet and a.press_release_id = r.id)
      and not exists (select 1 from auto_press_log l where l.outlet_id = p_outlet and l.press_release_id = r.id and not l.ok)
      and not exists (select 1 from articles a2 join press_releases p2 on p2.id = a2.press_release_id
                      where a2.auto_generated and a2.outlet_id = p_outlet and a2.created_at > now() - interval '7 days'
                        and (a2.press_release_id = r.id or lower(p2.title) = lower(r.title)))
    order by coalesce(r.published_at, r.fetched_at) desc
    limit p_limit;
end $$;

create or replace function public.auto_press_ai_left(secret text, p_outlet uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare lim integer; used integer; ov boolean;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  lim := public.ai_limit_of(p_outlet);
  select coalesce(ai_overage, false) into ov from outlets where id = p_outlet;
  select count(*)::integer into used from ai_usage where outlet_id = p_outlet and created_at >= public.kst_month_start();
  return jsonb_build_object('limit', lim, 'used', used, 'overage', ov);
end $$;

create or replace function public.auto_press_ai_count(secret text, p_outlet uuid, p_user uuid, p_model text, p_tin integer, p_tout integer, p_cost numeric)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into ai_usage (outlet_id, user_id, kind, model, input_tokens, output_tokens, cost_usd, over_limit, done)
  values (p_outlet, p_user, 'draft', p_model, coalesce(p_tin, 0), coalesce(p_tout, 0), p_cost, false, true);
end $$;

revoke all on function public.auto_press_candidates_tiered(text, uuid, integer, integer) from public;
revoke all on function public.auto_press_ai_left(text, uuid) from public;
revoke all on function public.auto_press_ai_count(text, uuid, uuid, text, integer, integer, numeric) from public;
grant execute on function public.auto_press_candidates_tiered(text, uuid, integer, integer) to anon, authenticated;
grant execute on function public.auto_press_ai_left(text, uuid) to anon, authenticated;
grant execute on function public.auto_press_ai_count(text, uuid, uuid, text, integer, integer, numeric) to anon, authenticated;
