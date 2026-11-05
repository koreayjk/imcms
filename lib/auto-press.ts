import type { SupabaseClient } from '@supabase/supabase-js'
import { AiDraftError, activeModel, aiReady, draftWithModel, type AiDraft } from './ai-draft'
import { checkLegal, legalModel } from './ai-legal'
import type { LegalCheck } from './legal-types'
import { legalContentHash } from './legal-hash'
import { AI_NOTICE_DEFAULT, aiNoticeText, withAiNotice } from './ai-notice'
import { downloadUrl, searchOpenPhotos } from './photo-search'
import { searchCommons } from './commons-photo'
import { ensureFullBody, escapeHtml, htmlToText, pressTextForAi, sourceLabel, type PressRelease } from './press'
import { PRESS_SOURCES, fieldOfSource, foreignTopicOf, isForeignSource, isUsSource, pressHintsFromSections, usableKeywords } from './press-sources'
import { buildSite, type OutletRow } from './sites'

// 보도자료 → AI 기사 → 법적 검수 → 승인 대기 저장 (매시간 크론이 매체마다 한 번 부른다)
//   서버리스 60초 안에 끝나도록 AI 시간을 나눠 쓴다. 로그인이 없으므로 모든 읽기·쓰기는 DB 함수(auto-press-articles.sql)로 한다

export type Plan = {
  outlet: OutletRow
  cfg: { enabled: boolean; daily_limit: number; tz: string; start_hour: number; end_hour: number; byline: string; author_id: string | null; require_words?: string[]; block_words?: string[]; trusted_sources?: string[] }
  today: number
  categories: { id: string; slug: string; name: string }[]
}
type Cand = { id: string; source_key: string; source_name: string; title: string; link: string; summary: string | null; body_html: string | null; image_url: string | null; published_at: string | null }

export function localHour(tz: string, at = new Date()) {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false }).format(at))
  return h % 24
}

// 사람이 먼저 봐야 하는 주제는 자동으로 쓰지 않는다 (왕실 불경, 성폭력, 자살 등)
const SENSITIVE = /lese[- ]?majest|royalist|monarch|rape|sexual assault|suicide|child abuse|불경죄|왕정|왕실|성폭행|성폭력|자살/i

// 제목 비교용 단어 (영문은 4자 이상 단어, 한글은 두 글자씩)
function tokens(t: string) {
  const s = t.toLowerCase()
  const out = new Set<string>()
  for (const w of s.match(/[a-z0-9]{4,}/g) ?? []) out.add(w)
  for (const w of s.match(/[가-힣]{2,}/g) ?? []) for (let i = 0; i < w.length - 1; i++) out.add(w.slice(i, i + 2))
  return out
}
function similar(a: string, b: string) {
  const x = tokens(a), y = tokens(b)
  if (x.size < 3 || y.size < 3) return false
  let n = 0
  for (const t of x) if (y.has(t)) n++
  return n / (x.size + y.size - n) >= 0.5
}

// 이 매체가 쓸 수 있는 출처인지 + 얼마나 잘 맞는지(점수). 보도자료함 '추천' 탭과 같은 기준
function rankCandidates(plan: Plan, cands: Cand[], recentTitles: string[] = []) {
  const names = plan.categories.map((c) => c.name)
  const site = buildSite(plan.outlet, plan.categories.map((c) => ({ slug: c.slug, name: c.name })))
  const english = site.lang === 'en'
  const topics = site.pressForeignTopics ?? []
  const auto = !site.pressKeywords.length && !site.pressFields.length ? pressHintsFromSections(names) : null
  let keywords = usableKeywords(site.pressKeywords.length ? site.pressKeywords : auto?.keywords ?? [])
  // 키워드가 하나도 없으면 섹션 이름으로 대신한다
  if (!keywords.length) keywords = usableKeywords(names.filter((n) => n.length >= 2))
  const fields = site.pressFields.length ? site.pressFields : auto?.fields ?? []
  const allowed = new Map(PRESS_SOURCES.map((s) => [s.key, s]))
  // 편집장이 보도자료함에서 직접 골라 추천에 넣은 출처
  const picked = new Set(site.pressSources ?? [])
  const lc = keywords.map((k) => k.toLowerCase())

  const scored: { c: Cand; score: number }[] = []
  for (const c of cands) {
    const src = allowed.get(c.source_key)
    if (!src) continue
    const hay = `${c.title} ${c.summary ?? ''}`.toLowerCase()
    if (SENSITIVE.test(hay)) continue
    const req = (plan.cfg.require_words ?? []).map((w) => w.toLowerCase())
    const blk = (plan.cfg.block_words ?? []).map((w) => w.toLowerCase())
    if (blk.some((w) => hay.includes(w))) continue
    const trusted = (plan.cfg.trusted_sources ?? []).some((k) => c.source_key === k || c.source_key.startsWith(k))
    if (req.length && !trusted && !req.some((w) => hay.includes(w))) continue
    if (recentTitles.some((t) => similar(t, c.title))) continue
    const hits = lc.filter((k) => hay.includes(k)).length
    const titleHit = lc.some((k) => c.title.toLowerCase().includes(k))
    let ok = false
    let base = 0
    if (english) {
      if (!isUsSource(c.source_key)) continue
      ok = !!src.local || titleHit || picked.has(c.source_key)
      base = src.local || picked.has(c.source_key) ? 2 : 0
    } else {
      if (isUsSource(c.source_key)) continue
      const tp = foreignTopicOf(c.source_key)
      if (tp) { ok = topics.includes(tp); base = 3 }
      else if (picked.has(c.source_key)) { ok = true; base = 2 }
      else if (fieldOfSource(c.source_key)) { ok = fields.includes(fieldOfSource(c.source_key)!); base = 2 }
      else {
        // 일반 출처(정부·지자체 등): 추천 키워드가 제목에 있거나, 매체의 필수 단어(지역 등)가 있거나, 이 매체가 믿는 출처면 쓴다
        ok = titleHit || trusted || (req.length > 0 && req.some((w) => hay.includes(w)))
        base = 0
      }
    }
    if (!ok) continue
    // 제목이 너무 짧거나 광고성인 것은 뒤로
    scored.push({ c, score: base * 10 + hits * 3 + (c.published_at ? new Date(c.published_at).getTime() / 1e13 : 0) })
  }
  return scored.sort((a, b) => b.score - a.score).map((x) => x.c)
}

const SKIP_CAT = /오피니언|칼럼|사설|인터뷰|기고|기자수첩|포토|기획|특집|opinion|editorial|column|interview/i
const selectableCategories = (plan: Plan) => plan.categories.filter((c) => !SKIP_CAT.test(c.name))

function pickCategory(plan: Plan, draft: AiDraft) {
  const pool = selectableCategories(plan)
  const asked = draft.category?.trim().toLowerCase()
  const byAi = asked ? pool.find((c) => c.name.trim().toLowerCase() === asked) : null
  if (byAi) return byAi.id
  const hay = `${draft.title} ${(draft.keywords ?? []).join(' ')} ${draft.paragraphs[0] ?? ''}`.toLowerCase()
  let best: { id: string; score: number } | null = null
  for (const c of pool) {
    const n = c.name.toLowerCase().trim()
    if (!n) continue
    const words = n.split(/[\s·/&,]+/).filter((w) => w.length >= 2)
    const score = (hay.includes(n) ? n.length + 3 : 0) + words.filter((w) => hay.includes(w)).reduce((s, w) => s + w.length, 0)
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score }
  }
  if (best) return best.id
  const general = pool.find((c) => /종합|뉴스|latest|news|world|local/i.test(c.name))
  return (general ?? pool[0] ?? plan.categories[0])?.id ?? null
}

// 보도자료 본문에 실린 사진 (설명 문단이 붙어 있으면 함께)
function pressPhoto(r: PressRelease): { src: string; caption: string } | null {
  if (isForeignSource(r.source_key) && !isUsSource(r.source_key)) return null // 해외 언론 사진은 그 언론사 저작물이라 쓰지 않는다
  const html = r.body_html ?? ''
  const m = /<img[^>]+src="(https:\/\/[^"]+)"[^>]*>(?:<p><em>▲\s*([\s\S]*?)<\/em><\/p>)?/i.exec(html)
  const src = (m?.[1] ?? r.image_url ?? '').trim()
  if (!/^https:\/\//.test(src) || /logo|icon|sprite|avatar|pixel|1x1/i.test(src)) return null
  const cap = m?.[2]?.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim()
  return { src: src.replace(/&amp;/g, '&'), caption: cap || '' }
}

// 사진 찾기: 위키미디어 공용 → (안 되면) Openverse. 검색어가 안 맞으면 일반 검색어로 넓혀 간다. 실패 이유를 돌려준다
async function openPhoto(keywords: string[], english: boolean, seed: number) {
  const lang = english ? 'en' : 'ko'
  const tried: string[] = []
  const generic = english ? ['Texas', 'city street', 'newspaper'] : ['news', 'city skyline', 'newspaper']
  const queries = Array.from(new Set([...keywords.map((k) => k.trim()).filter(Boolean).slice(0, 4), ...generic]))
  for (const [i, q] of queries.entries()) {
    try {
      const c = await searchCommons(q, lang, seed)
      if (c) return { photo: { src: c.src, caption: c.caption, page: c.page, generic: i >= Math.min(keywords.filter(Boolean).length, 4) }, tried }
      tried.push(`공용 '${q}' 없음`)
    } catch (e) { tried.push(e instanceof Error ? e.message : '공용 오류') }
    try {
      const hits = await searchOpenPhotos(q, 6, lang)
      const h = hits.find((x) => /^https:\/\//.test(x.url))
      if (h) return { photo: { src: downloadUrl(h.url), caption: h.credit, page: h.page, generic: i >= Math.min(keywords.filter(Boolean).length, 4) }, tried }
      tried.push(`Openverse '${q}' 없음`)
    } catch (e) { tried.push(e instanceof Error ? e.message.slice(0, 40) : 'Openverse 오류') }
  }
  return { photo: null, tried }
}

const raceTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new AiDraftError('시간 초과')), ms))])

export type RunResult = { outlet: string; status: 'saved' | 'skipped' | 'failed'; message: string; articleId?: string | null }

export async function runAutoArticle(supabase: SupabaseClient, secret: string, outletId: string, opts: { force?: boolean } = {}): Promise<RunResult> {
  const started = Date.now()
  const { data: plan, error: pe } = await supabase.rpc('auto_press_plan', { secret, p_outlet: outletId })
  if (pe) return { outlet: outletId, status: 'failed', message: `계획 읽기 실패: ${pe.message}` }
  const p = plan as Plan | null
  if (!p?.cfg?.enabled) return { outlet: outletId, status: 'skipped', message: '자동 작성이 꺼져 있거나 설정이 없습니다' }
  const name = p.outlet.name
  const note = (press: string | null, ok: boolean, message: string, cost: number | null = null) =>
    supabase.rpc('auto_press_note', { secret, p_outlet: outletId, p_press: press, p_ok: ok, p_message: message, p_cost: cost })

  const hour = localHour(p.cfg.tz)
  if (!opts.force && (hour < p.cfg.start_hour || hour > p.cfg.end_hour)) return { outlet: name, status: 'skipped', message: `현지 ${hour}시: 작성 시간대(${p.cfg.start_hour}~${p.cfg.end_hour}시) 아님` }
  if (p.today >= p.cfg.daily_limit) return { outlet: name, status: 'skipped', message: `오늘 ${p.today}건 작성 완료 (하루 ${p.cfg.daily_limit}건)` }
  if (!aiReady()) { await note(null, false, 'AI 키(ANTHROPIC_API_KEY 또는 GEMINI_API_KEY)가 설정되지 않았습니다'); return { outlet: name, status: 'failed', message: 'AI 키 없음' } }
  if (!p.cfg.author_id) { await note(null, false, '기자 계정(author_id)이 비어 있습니다'); return { outlet: name, status: 'failed', message: '기자 계정 없음' } }

  const { data: raw, error: ce } = await supabase.rpc('auto_press_candidates', { secret, p_outlet: outletId, p_days: 4, p_limit: 600, p_english: p.outlet.site?.lang === 'en' })
  if (ce) return { outlet: name, status: 'failed', message: `보도자료 읽기 실패: ${ce.message}` }
  const { data: rt } = await supabase.rpc('auto_press_recent_titles', { secret, p_days: 3 })
  const ranked = rankCandidates(p, (raw ?? []) as Cand[], ((rt ?? []) as { title: string }[]).map((x) => x.title))
  if (!ranked.length) { await note(null, false, '맞는 보도자료가 없습니다 (최근 4일)'); return { outlet: name, status: 'skipped', message: '맞는 보도자료 없음' } }

  const site = buildSite(p.outlet, p.categories.map((c) => ({ slug: c.slug, name: c.name })))
  const english = site.lang === 'en'
  const model = activeModel()!
  const failures: string[] = []

  for (const cand of ranked.slice(0, 4)) {
    if (Date.now() - started > 38_000) break
    let r = cand as PressRelease
    try {
      // 1) 전문 읽기
      const full = await ensureFullBody(supabase, r)
      if (full.body_html && full.body_html !== r.body_html) await supabase.rpc('auto_press_cache_body', { secret, p_id: r.id, p_html: full.body_html, p_image: full.image_url ?? '' })
      r = full
      const text = pressTextForAi(r.body_html ?? '') || r.summary || ''
      if (text.replace(/\s/g, '').length < 150) { await note(r.id, false, '본문이 너무 짧아 건너뜀'); failures.push('본문 짧음'); continue }

      // 2) AI 기사
      const left = 52_000 - (Date.now() - started)
      const dr = await draftWithModel(model.id, { title: r.title, text, source: sourceLabel(r), foreign: isForeignSource(r.source_key), us: isUsSource(r.source_key), topic: foreignTopicOf(r.source_key) ?? undefined, link: r.link, categories: selectableCategories(p).map((c) => c.name) }, Math.min(30_000, left - 18_000))
      const draft: AiDraft = dr.draft
      let cost = dr.costUsd

      // 3) 법적 검수 (남은 시간 안에서). 못 하면 그 사실을 메모에 남기고 편집장이 직접 검수하게 한다
      let legal: LegalCheck | null = null
      let legalErr = ''
      if (legalModel()) {
        try {
          const lr = await raceTimeout(checkLegal({ title: draft.title, subtitle: draft.subtitle, text: draft.paragraphs.join('\n\n') }), Math.max(8_000, 56_000 - (Date.now() - started) - 6_000))
          legal = lr.check
          cost += lr.costUsd
        } catch (e) { legalErr = e instanceof Error ? e.message : '법적 검수 실패' }
      } else legalErr = '법적 검수 모델이 설정되지 않았습니다'

      // 4) 검수가 고칠 문장을 알려 준 곳은 바로 고친다 (quote → fix)
      let title = draft.title
      let subtitle = draft.subtitle
      let paras = [...draft.paragraphs]
      const fixed: string[] = []
      if (legal) {
        for (const is of legal.issues) {
          const fix = is.fix
          if (!fix || !is.quote || fix === is.quote) continue
          let hit = false
          paras = paras.map((x) => (x.includes(is.quote) ? ((hit = true), x.replace(is.quote, () => fix)) : x))
          if (title.includes(is.quote)) { title = title.replace(is.quote, () => fix); hit = true }
          if (subtitle.includes(is.quote)) { subtitle = subtitle.replace(is.quote, () => fix); hit = true }
          if (hit) { is.decision = 'fixed'; fixed.push(is.reason) }
        }
        legal.content_hash = legalContentHash(title, subtitle, paras.join('\n\n'))
      }

      // 5) 사진: 보도자료 사진 → 없으면 기사 내용으로 무료 공개 사진 검색
      let photo = pressPhoto(r) as { src: string; caption: string; page?: string } | null
      let photoNote = ''
      if (photo) {
        photo.caption ||= english ? `Photo provided by ${sourceLabel(r)}` : `사진=${sourceLabel(r)} 제공`
        photoNote = `보도자료에 실린 사진을 썼습니다 (출처: ${sourceLabel(r)}). 사용 권리를 확인해 주세요.`
      } else {
        const kws = [...(legal?.photo_keywords ?? []), ...(english ? (draft.keywords ?? []) : [])]
        const seed = Array.from(r.id).reduce((n, ch) => n + ch.charCodeAt(0), 0)
        const found = await openPhoto(kws.length ? kws : [draft.title], english, seed)
        photo = found.photo
        if (photo) photoNote = `보도자료에 사진이 없어 공개 라이선스 사진을 검색해 넣었습니다: ${photo.caption}${photo.page ? ` / ${photo.page}` : ''}. ${(photo as { generic?: boolean }).generic ? '기사와 직접 관련된 사진을 못 찾아 일반 사진을 넣었으니 ' : ''}기사와 맞는지 확인해 주세요.`
        else { await note(r.id, false, `넣을 사진을 찾지 못해 건너뜀 (${found.tried.slice(0, 6).join(', ')})`, cost); failures.push('사진 없음'); continue }
      }
      if (!photo) { await note(r.id, false, '넣을 사진을 찾지 못해 건너뜀', cost); failures.push('사진 없음'); continue }

      // 6) 본문 HTML
      const html = paras.map((x) => `<p>${escapeHtml(x)}</p>`)
      const photoHtml = `<img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}"><p><em>▲ ${escapeHtml(photo.caption)}</em></p>`
      let body = [html[0], photoHtml, ...html.slice(1)].join('')
      if (!english) {
        const byline = `[${name}=${p.cfg.byline} 기자]&nbsp;`
        body = body.replace(/^<p>/, `<p>${byline}`)
      }
      body = withAiNotice(body, aiNoticeText(p.outlet.site) ?? AI_NOTICE_DEFAULT[english ? 'en' : 'ko'])

      // 7) 메모(편집장이 읽는 확인할 점)
      const notes: string[] = []
      if (legal) {
        const label = { low: '낮음', medium: '주의', high: '높음' }[legal.risk]
        notes.push(`AI 법적 검수: 위험도 ${label} — ${legal.summary}`)
        if (fixed.length) notes.push(`검수가 지적한 문장 ${fixed.length}건을 자동으로 고쳤습니다. 고친 곳은 기사 화면의 검수 결과에서 확인하세요.`)
        const open = legal.issues.filter((i) => i.decision !== 'fixed')
        for (const i of open.slice(0, 4)) notes.push(`[${i.severity === 'high' ? '꼭 확인' : '확인'}] ${i.reason} ${i.suggestion}`.trim())
        if (legal.risk === 'high') notes.push('⚠ 법적 위험도가 높게 나왔습니다. 발행 전에 반드시 편집장이 직접 검토하세요.')
      } else notes.push(`⚠ AI 법적 검수를 하지 못했습니다 (${legalErr}). 기사 편집 화면의 'AI 검수'를 먼저 실행한 뒤 승인하세요.`)
      notes.push(...draft.review_notes)
      notes.push(photoNote)
      notes.push(`자동 작성 기사: 보도자료 '${r.title}' (${sourceLabel(r)})를 바탕으로 AI가 쓰고 법적 검수를 거쳐 승인 대기로 올렸습니다. 원문: ${r.link}`)

      const { data: id, error: se } = await supabase.rpc('auto_press_save', {
        secret, p_outlet: outletId, p_press: r.id, p_category: pickCategory(p, { ...draft, title, paragraphs: paras }),
        p_title: title, p_body: body, p_excerpt: subtitle || null, p_thumb: photo.src, p_tags: draft.keywords ?? [],
        p_notes: notes.filter(Boolean).map((n) => `• ${n}`).join('\n'), p_legal: legal, p_cost: Number(cost.toFixed(5)),
      })
      if (se) { await note(r.id, false, `저장 실패: ${se.message}`, cost); failures.push(se.message); continue }
      return { outlet: name, status: 'saved', message: `승인 대기로 저장: ${title}`, articleId: id as string | null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류'
      await note(r.id, false, `실패: ${msg}`)
      failures.push(msg)
      // AI 키·한도 같은 전체 문제는 더 시도하지 않는다
      if (/키가 올바르지|사용 한도|결제/.test(msg)) break
    }
  }
  return { outlet: name, status: 'failed', message: `이번 시간에는 기사를 만들지 못했습니다: ${failures.join(' / ') || '시간 부족'}` }
}
