-- 기사 영어 번역 (Supabase SQL 에디터에서 1회 실행. 여러 번 실행해도 된다)
--   · article_translations: 기사마다 언어별 번역(제목·부제·본문). 홈페이지의 "한글 | English" 버튼을 누르면 이 번역이 보인다
--   · 번역 대상 매체는 outlets.site.translate = {"langs":["en"], "name":"…", "sections":{"slug":"English name"}, "description":"…"} 로 정한다
--   · 1분마다 /api/cron/translate 가 번역이 없거나(또는 기사가 고쳐져 번역이 낡은) 발행 기사를 AI로 번역해 저장한다 (한 번에 여러 건)
--   · 실패한 기사는 3번까지 다시 시도하고 멈춘다 (error 칸에 이유)

create table if not exists article_translations (
  article_id uuid not null references articles(id) on delete cascade,
  lang text not null,
  title text,
  excerpt text,
  body text,
  src_hash text,
  model text,
  tries int not null default 0,
  error text,
  translated_at timestamptz,
  primary key (article_id, lang)
);
alter table article_translations enable row level security;

-- 독자(익명)는 발행된 기사의 번역만 읽는다
drop policy if exists "public_translations_select" on article_translations;
create policy "public_translations_select" on article_translations for select to anon, authenticated
  using (title is not null and exists (select 1 from articles a where a.id = article_id and a.status = 'published' and a.published_at <= now()));

-- 번역할 기사 목록 (서버 전용, secret 필요)
create or replace function public.translate_pending(secret text, n int default 6)
returns table (id uuid, outlet_id uuid, title text, excerpt text, body text, src_hash text)
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    select a.id, a.outlet_id, a.title, a.excerpt, a.body, md5(coalesce(a.title,'') || '|' || coalesce(a.excerpt,'') || '|' || coalesce(a.body,''))
    from articles a
    join outlets o on o.id = a.outlet_id
    left join article_translations t on t.article_id = a.id and t.lang = 'en'
    where a.status = 'published' and a.published_at <= now()
      and (o.site #> '{translate,langs}') ? 'en'
      and (t.article_id is null
           or (t.src_hash is distinct from md5(coalesce(a.title,'') || '|' || coalesce(a.excerpt,'') || '|' || coalesce(a.body,'')) and t.tries < 3))
    order by a.published_at desc
    limit least(greatest(n, 1), 20);
end $$;

create or replace function public.translate_save(secret text, p_article uuid, p_title text, p_excerpt text, p_body text, p_hash text, p_model text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into article_translations (article_id, lang, title, excerpt, body, src_hash, model, tries, error, translated_at)
  values (p_article, 'en', p_title, p_excerpt, p_body, p_hash, p_model, 0, null, now())
  on conflict (article_id, lang) do update
    set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, src_hash = excluded.src_hash, model = excluded.model,
        tries = 0, error = null, translated_at = now();
end $$;

create or replace function public.translate_fail(secret text, p_article uuid, p_error text)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into article_translations (article_id, lang, tries, error) values (p_article, 'en', 1, left(p_error, 300))
  on conflict (article_id, lang) do update set tries = article_translations.tries + 1, error = left(p_error, 300);
end $$;

revoke all on function public.translate_pending(text, int) from public;
revoke all on function public.translate_save(text, uuid, text, text, text, text, text) from public;
revoke all on function public.translate_fail(text, uuid, text) from public;
grant execute on function public.translate_pending(text, int) to anon, authenticated;
grant execute on function public.translate_save(text, uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.translate_fail(text, uuid, text) to anon, authenticated;

-- 1분마다 번역 서버를 깨운다
select cron.unschedule(jobid) from cron.job where jobname = 'translate-articles';
select cron.schedule(
  'translate-articles',
  '* * * * *',
  $$
  select net.http_get(
    url := 'https://imcms.vercel.app/api/cron/translate',
    headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
    timeout_milliseconds := 60000
  );
  $$
);

-- 번역을 켤 매체: 말레이시아 타임즈, 필리핀 타임즈, 치앙마이 타임즈, 치앙마이미션타임즈 (영어 이름·섹션 이름·소개글 포함)
update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{translate}', $j${
  "langs": ["en"], "name": "Malaysia Times",
  "description": "News on Malaysia's education policy, study-abroad rules, and economy, investment and industry. Written from official sources for Korean readers interested in studying, education business and expanding into Malaysia.",
  "sections": {"education":"Education","study":"Study & Life","business":"Business","invest":"Investment & Industry","policy":"Policy & Regulation","tour":"Tourism","religion":"Religion","korea-malaysia-cooperation":"Korea–Malaysia Exchange"}
}$j$::jsonb, true) where name = '말레이시아 타임즈';
update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{translate}', $j${
  "langs": ["en"], "name": "Philippines Times",
  "sections": {"education":"Education","study":"Study & Life","business":"Business","invest":"Investment & Industry","policy":"Policy & Regulation","tour":"Tourism","religion":"Religion","korea-philippines-cooperation":"Korea–Philippines Exchange"}
}$j$::jsonb, true) where name = '필리핀 타임즈';
update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{translate}', $j${
  "langs": ["en"], "name": "Chiang Mai Times",
  "description": "Business news on Thailand's economy, investment, industry and regulation, centered on Chiang Mai. Written from official sources for Korean, Thai and American readers doing or planning business in Thailand.",
  "sections": {"business":"Business","chiangmai":"Chiang Mai","economy":"Economy","invest":"Investment","policy":"Policy & Regulation","travel":"Travel & Life","global":"Global"}
}$j$::jsonb, true) where name = '치앙마이 타임즈';
update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{translate}', $j${
  "langs": ["en"], "name": "Chiang Mai Mission Times",
  "description": "A global missions news outlet covering world mission trends, mission fields, unreached peoples and missionary stories, starting from Chiang Mai, Thailand.",
  "sections": {"trends":"Mission Trends","chiangmai":"Chiang Mai","asia":"Asia","world":"World Missions","unreached":"Unreached Peoples","missionaries":"Missionary Stories","church":"Church & Missions","opinion":"Opinion",
    "trends-korea":"Korean Missions","trends-data":"Statistics & Research","trends-events":"Missions Conferences & Forums",
    "cm-field":"Chiang Mai Field","cm-thai-church":"Thai Church","cm-hill-tribes":"Hill Tribes","cm-life":"Missionary Life",
    "asia-southeast":"Southeast Asia","asia-northeast":"Northeast Asia","asia-south":"South Asia","asia-central":"Central Asia",
    "world-mena":"Middle East & North Africa","world-africa":"Africa","world-europe":"Europe & Eurasia","world-americas":"Americas & Oceania",
    "up-peoples":"People Stories","up-bible":"Bible Translation","up-prayer":"Intercessory Prayer",
    "ms-interview":"Interviews","ms-letters":"Letters from the Field","ms-care":"Member Care","ms-retired":"Retired Missionaries",
    "ch-short-term":"Short-Term Missions","ch-migrants":"Migrant Ministry","ch-nextgen":"Next Generation Missions","ch-mobilization":"Mission Mobilization",
    "op-column":"Columns","op-theology":"Mission Theology"}
}$j$::jsonb, true) where name = '치앙마이미션타임즈';

-- 확인: select o.name, count(t.article_id) filter (where t.title is not null) translated from outlets o left join articles a on a.outlet_id = o.id left join article_translations t on t.article_id = a.id where (o.site #> '{translate,langs}') ? 'en' group by 1;
