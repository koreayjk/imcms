-- 보도자료함 품질 판정: 글이 짧거나 사진 없는 자료는 목록에 올리지 않는다 (Supabase SQL 에디터에서 1회 실행, 여러 번 실행해도 된다)
--   · press_releases.quality: 'ok'(글 충분+사진 있음) / 'poor'(글이 짧거나 사진 없음) / null(아직 판정 전)
--   · 5분마다 /api/cron/press-quality 가 판정 전 자료를 최신순으로 상세 페이지까지 읽어 판정한다 (본문도 이때 같이 저장)
--   · 목록에는 'ok' 만 보인다. 직접 등록(manual)·메일로 받은 자료(email)는 판정하지 않고 항상 보인다
--   · 기준(lib/press-quality.ts): 한국어 300자 이상 / 영문 150단어 이상 + 사진 1장 이상 (해외 언론은 사진 조건 없음)
alter table press_releases add column if not exists quality text check (quality in ('ok', 'poor'));
alter table press_releases add column if not exists quality_note text;
alter table press_releases add column if not exists quality_tries int not null default 0;
create index if not exists press_releases_quality_idx on press_releases (quality, published_at desc);
create index if not exists press_releases_unjudged_idx on press_releases (fetched_at desc) where quality is null;

-- 판정 전 자료 가져오기 (예약 작업용, 비밀 열쇠가 맞을 때만)
create or replace function public.press_quality_pending(secret text, n int)
returns table (id uuid, source_key text, source_name text, title text, link text, summary text, body_html text, image_url text, published_at timestamptz, quality_tries int)
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    select r.id, r.source_key, r.source_name, r.title, r.link, r.summary, r.body_html, r.image_url, r.published_at, r.quality_tries
    from press_releases r
    where r.quality is null and r.quality_tries < 3 and r.source_key not in ('manual', 'email')
      and r.fetched_at > now() - interval '8 days'
    order by r.published_at desc nulls last, r.fetched_at desc
    limit least(greatest(n, 1), 200);
end $$;

-- 판정 결과 저장: p_rows = [{id, body_html, image_url, quality: ok|poor|retry, note}]
--   retry(본문을 못 읽음)는 3번까지 다시 시도하고, 그래도 안 되면 poor 로 처리한다
create or replace function public.press_quality_apply(secret text, p_rows jsonb)
returns int language plpgsql security definer set search_path = public, private as $$
declare n int := 0; x jsonb; q text; tries int;
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    q := x->>'quality';
    select quality_tries + 1 into tries from press_releases where id = (x->>'id')::uuid;
    if tries is null then continue; end if;
    if q = 'retry' then
      update press_releases set quality_tries = tries,
             quality = case when tries >= 3 then 'poor' else null end,
             quality_note = case when tries >= 3 then '본문을 읽지 못함' else quality_note end
       where id = (x->>'id')::uuid;
    elsif q in ('ok', 'poor') then
      update press_releases set quality = q, quality_note = nullif(left(x->>'note', 120), ''), quality_tries = tries,
             body_html = coalesce(x->>'body_html', body_html), image_url = coalesce(x->>'image_url', image_url)
       where id = (x->>'id')::uuid;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.press_quality_pending(text, int) from public;
revoke all on function public.press_quality_apply(text, jsonb) from public;
grant execute on function public.press_quality_pending(text, int) to anon, authenticated;
grant execute on function public.press_quality_apply(text, jsonb) to anon, authenticated;

-- 5분마다 판정 서버를 깨운다
select cron.unschedule(jobid) from cron.job where jobname = 'press-quality';
select cron.schedule(
  'press-quality',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://imcms.vercel.app/api/cron/press-quality',
    headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
    timeout_milliseconds := 60000
  );
  $$
);

-- 확인: select quality, count(*) from press_releases where source_key not in ('manual','email') group by 1;
