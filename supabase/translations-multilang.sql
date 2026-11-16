-- 번역 언어 확장: 영어(en) 외에 일본어(ja)·중국어(zh) (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   · outlets.site.translate.langs 에 넣은 언어마다 기사 번역이 만들어진다 (article_translations 의 lang 칸)
--   · 일본어·중국어판 매체 이름·섹션 이름은 site.translate.i18n.ja / .zh 에 { name, description, sections } 로 둔다
--   · 이 파일의 1단계(함수 교체)는 예전 코드와 같이 써도 안전하다 (영어만 켜 둔 매체는 달라지는 것이 없음). 2단계(미래농업매거진 켜기)는 새 코드가 배포된 뒤에 실행한다

-- 1단계 ─ 함수 교체
drop function if exists public.translate_pending(text, int);
create or replace function public.translate_pending(secret text, n int default 6)
returns table (id uuid, outlet_id uuid, title text, excerpt text, body text, src_hash text, lang text)
language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  return query
    select a.id, a.outlet_id, a.title, a.excerpt, a.body, md5(coalesce(a.title,'') || '|' || coalesce(a.excerpt,'') || '|' || coalesce(a.body,'')), l.lang
    from articles a
    join outlets o on o.id = a.outlet_id
    cross join lateral jsonb_array_elements_text(coalesce(o.site #> '{translate,langs}', '[]'::jsonb)) as l(lang)
    left join article_translations t on t.article_id = a.id and t.lang = l.lang
    where a.status = 'published' and a.published_at <= now()
      and l.lang in ('en', 'ja', 'zh')
      and (t.article_id is null
           or (t.src_hash is distinct from md5(coalesce(a.title,'') || '|' || coalesce(a.excerpt,'') || '|' || coalesce(a.body,'')) and t.tries < 3))
      and coalesce(t.tries, 0) < 3
    order by a.published_at desc, l.lang
    limit least(greatest(n, 1), 20);
end $$;

drop function if exists public.translate_save(text, uuid, text, text, text, text, text);
create or replace function public.translate_save(secret text, p_article uuid, p_title text, p_excerpt text, p_body text, p_hash text, p_model text, p_lang text default 'en')
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into article_translations (article_id, lang, title, excerpt, body, src_hash, model, tries, error, translated_at)
  values (p_article, p_lang, p_title, p_excerpt, p_body, p_hash, p_model, 0, null, now())
  on conflict (article_id, lang) do update
    set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body, src_hash = excluded.src_hash, model = excluded.model,
        tries = 0, error = null, translated_at = now();
end $$;

drop function if exists public.translate_fail(text, uuid, text);
create or replace function public.translate_fail(secret text, p_article uuid, p_error text, p_lang text default 'en')
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not public.press_cron_check(secret) then raise exception 'forbidden'; end if;
  insert into article_translations (article_id, lang, tries, error) values (p_article, p_lang, 1, left(p_error, 300))
  on conflict (article_id, lang) do update set tries = article_translations.tries + 1, error = left(p_error, 300);
end $$;

revoke all on function public.translate_pending(text, int) from public;
revoke all on function public.translate_save(text, uuid, text, text, text, text, text, text) from public;
revoke all on function public.translate_fail(text, uuid, text, text) from public;
grant execute on function public.translate_pending(text, int) to anon, authenticated;
grant execute on function public.translate_save(text, uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.translate_fail(text, uuid, text, text) to anon, authenticated;

-- 2단계 ─ 미래농업매거진: 영어·일본어·중국어 번역 켜기 (새 코드 배포 뒤에 실행)
-- update outlets set site = jsonb_set(coalesce(site, '{}'::jsonb), '{translate}', $j${
--   "langs": ["en", "ja", "zh"],
--   "name": "Future Agriculture Magazine",
--   "sections": {"young-farmer":"Young Farmer of the Month","feature":"Special Features","agri-policy":"Agricultural Policy","companies":"Company Profiles","trend-report":"Trend Report","farm-field":"On the Farm","opinion":"Opinion"},
--   "i18n": {
--     "ja": {"name": "未来農業マガジン", "sections": {"young-farmer":"今月の青年農業者","feature":"企画・特集","agri-policy":"農政","companies":"企業動向","trend-report":"トレンドレポート","farm-field":"農業の現場","opinion":"オピニオン"}},
--     "zh": {"name": "未来农业杂志", "sections": {"young-farmer":"本月青年农民","feature":"策划·专题","agri-policy":"农业政策","companies":"企业动态","trend-report":"趋势报告","farm-field":"农业一线","opinion":"观点"}}
--   }
-- }$j$::jsonb, true) where name = '미래농업매거진';
