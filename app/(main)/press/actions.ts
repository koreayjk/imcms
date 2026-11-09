'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { findPressSource, foreignTopicOf, isForeignSource, isUsSource } from '@/lib/press-sources'
import { MANUAL_SOURCE, ensureFullBody, escapeHtml, htmlToText, pressTextForAi, refreshPress, sourceLabel, textToParagraphs, type PressRelease } from '@/lib/press'
import { isNonPhotoImage } from '@/lib/press-quality'
import { AiDraftError, draftFromPressRelease } from '@/lib/ai-draft'
import { aiLimitMessage, finishAi, releaseAi, reserveAi } from '@/lib/ai-usage'
import { duplicateNotes } from '@/lib/duplicate-check'
import { aiNoticeText, withAiNotice } from '@/lib/ai-notice'
import { cleanPressSources, cleanPressTiers, type OutletSiteSettings } from '@/lib/sites'

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// 보도자료함 맞춤 자료 그룹 저장 (편집장 이상). 키워드를 하나도 안 정하면 그룹 설정을 지운다 (supabase/press-tiers.sql)
export async function savePressTiers(outletId: string, tiers: unknown): Promise<{ error?: string; ok?: string }> {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isEditorPlus && !isStaff) return { error: t('편집장 이상만 고칠 수 있습니다.', 'Only Editors-in-Chief and above can edit this.') }
  if (!outletId) return { error: t('매체를 먼저 골라 주세요.', 'Choose an outlet first.') }
  const clean = cleanPressTiers(tiers)
  const { error } = await supabase.rpc('outlet_press_tiers_save', { o: outletId, p_tiers: clean.some((g) => g.keywords.length || g.sources.length) ? clean : null })
  if (error) {
    if (/outlet_press_tiers_save|function/i.test(error.message) && /does not exist|schema cache|find/i.test(error.message)) return { error: t('이 기능을 쓰려면 운영팀이 Supabase에서 press-tiers.sql을 실행해야 합니다.', 'To use this feature, the IM Newsroom team needs to run press-tiers.sql in Supabase.') }
    return { error: error.message.replace(/^.*?:\s*/, '') }
  }
  // 그룹에 담은 출처는 "그룹 없이 ★로 넣은 출처"에서 뺀다 (한 출처가 두 곳에 있지 않게)
  const grouped = new Set(clean.flatMap((g) => g.sources))
  if (grouped.size) {
    const { data } = await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle()
    const cur = cleanPressSources(((data?.site ?? {}) as OutletSiteSettings).pressSources)
    const left = cur.filter((k) => !grouped.has(k))
    if (left.length !== cur.length) await supabase.rpc('outlet_press_sources_save', { o: outletId, p_sources: left })
  }
  // 화면은 이미 바뀌어 있으므로 다시 불러오지 않는다 (맞춤 자료 탭은 열 때 새로 읽는다)
  return { ok: clean.some((g) => g.keywords.length || g.sources.length) ? t('저장했습니다.', 'Saved.') : t('그룹 설정을 지웠습니다. 예전 추천 방식으로 돌아갑니다.', 'Groups cleared. The feed is back to the default recommendation.') }
}

export async function refreshNow() {
  const { supabase } = await getCmsContext()
  await refreshPress(supabase, true)
  revalidatePath('/press')
}

// 맞춤 자료에서 고른 보도자료를 이 매체에서만 가리거나(undo=false) 되돌린다(undo=true). 편집장 이상 (supabase/press-hidden.sql)
//   보도자료 원본은 지우지 않는다. 한 번에 50건까지
export async function hidePress(ids: string[], undo = false): Promise<{ error?: string; n?: number }> {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isEditorPlus && !isStaff) return { error: t('편집장 이상만 가릴 수 있습니다.', 'Only Editors-in-Chief and above can hide releases.') }
  if (!outletId) return { error: t('매체를 먼저 골라 주세요.', 'Choose an outlet first.') }
  const clean = Array.from(new Set((ids ?? []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 50)
  if (!clean.length) return { error: t('고른 자료가 없습니다.', 'No releases selected.') }
  const { data, error } = await supabase.rpc(undo ? 'press_unhide' : 'press_hide', { o: outletId, ids: clean })
  if (error) {
    if (/press_hide|press_unhide|function/i.test(error.message) && /does not exist|schema cache|find/i.test(error.message)) return { error: t('이 기능을 쓰려면 운영팀이 Supabase에서 press-hidden.sql을 실행해야 합니다.', 'To use this feature, the IM Newsroom team needs to run press-hidden.sql in Supabase.') }
    return { error: error.message.replace(/^.*?:\s*/, '') }
  }
  revalidatePath('/press')
  return { n: Number(data ?? 0) }
}

// 전체 탭에서 체크한 출처를 이 매체의 "맞춤 자료"에 넣거나 뺀다 (편집장 이상)
export async function savePressSources(formData: FormData) {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  // 체크한 출처·검색어를 그대로 두고 전체 탭으로 돌아간다
  const sp = new URLSearchParams({ tab: 'all' })
  const q = String(formData.get('q') ?? '').slice(0, 50)
  if (q) sp.set('q', q)
  formData.getAll('s').map(String).filter((k) => /^[\w-]{1,40}$/.test(k)).slice(0, 80).forEach((k) => sp.append('s', k))
  const back = `/press?${sp.toString()}`
  const go = (msg?: string) => redirect(msg ? `${back}&msg=${encodeURIComponent(msg)}` : back)
  if (!outletId || (!isEditorPlus && !isStaff)) return go(t('편집장 이상만 바꿀 수 있습니다.', 'Only Editors-in-Chief and above can change this.'))
  const remove = String(formData.get('mode') ?? '') === 'remove'
  const keys = cleanPressSources(formData.getAll('s').map(String))
  if (!keys.length) return go(t('넣거나 뺄 출처를 먼저 체크해 주세요. (메일·직접 등록 자료는 늘 맞춤 자료에 들어 있습니다)', 'Check the sources first. (Email and manually added releases are always in My feed.)'))
  const { data } = await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle()
  const cur = cleanPressSources(((data?.site ?? {}) as OutletSiteSettings).pressSources)
  const next = cleanPressSources(remove ? cur.filter((k) => !keys.includes(k)) : [...cur, ...keys])
  const { error } = await supabase.rpc('outlet_press_sources_save', { o: outletId, p_sources: next })
  if (error) {
    if (/outlet_press_sources_save|function/i.test(error.message) && /does not exist|schema cache|find/i.test(error.message)) return go(t('이 기능을 쓰려면 운영팀이 Supabase에서 press-sources-pick.sql을 실행해야 합니다.', 'To use this feature, the IM Newsroom team needs to run press-sources-pick.sql in Supabase.'))
    return go(error.message.replace(/^.*?:\s*/, ''))
  }
  revalidateTag('sites', { expire: 0 })
  revalidatePath('/press')
  return go(remove ? t('맞춤 자료에서 뺐습니다.', 'Removed from My feed.') : t('맞춤 자료에 넣었습니다. 왼쪽 “맞춤 자료” 탭에서 볼 수 있습니다.', 'Added to My feed. See it in the “My feed” tab.'))
}

// 보도자료 사진을 우리 저장소로 옮긴다 (원본 사이트가 사진을 지워도 기사가 깨지지 않게)
async function copyImage(supabase: SupabaseClient, src: string, outletId: string | null) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(src, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    const ext = IMAGE_TYPES[type]
    if (!res.ok || !ext) return null
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength > 10 * 1024 * 1024) return null
    const now = new Date()
    const path = `${outletId ?? 'common'}/press/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType: type, cacheControl: '31536000' })
    if (error) return null
    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

function firstSentences(text: string, max = 120) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const end = Math.max(cut.lastIndexOf('다.'), cut.lastIndexOf('. '))
  return end > 40 ? cut.slice(0, end + 1).trim() : `${cut.trim()}…`
}

// 사진과 그 아래 "▲ 설명" 문단을 한 덩어리로 뽑는다
function photoBlocks(html: string) {
  return Array.from(html.matchAll(/(?:<img[^>]*>|<div data-youtube-video[^>]*>[\s\S]*?<\/div>)(?:<p><em>▲[\s\S]*?<\/em><\/p>)?/g), (m) => m[0])
    .filter((b) => !/^<img\b/i.test(b) || !isNonPhotoImage(/\bsrc=["']([^"']+)["']/i.exec(b)?.[1] ?? ''))  // 공공누리 마크·로고는 사진이 아니다
}

export async function createArticleFromPress(id: string, mode: 'raw' | 'ai', form?: FormData) {
  const { supabase, user, profile, outletId } = await getCmsContext()
  const { t } = await getT()

  const { data } = await supabase.from('press_releases').select('*').eq('id', id).single()
  if (!data) throw new Error(t('보도자료를 찾을 수 없습니다.', 'Press release not found.'))
  const r = await ensureFullBody(supabase, data as PressRelease)
  // 해외 언론 기사는 그 언론사 저작물이라 원문 그대로 올리지 않는다 (AI가 출처를 밝힌 한국어 기사로 새로 쓴다)
  const foreign = isForeignSource(r.source_key)
  if (foreign && mode === 'raw') redirect(`/press/${id}?error=${encodeURIComponent(t('해외 언론 기사는 원문 그대로 올릴 수 없습니다. AI 기사로 만들어 주세요.', 'Stories from foreign news outlets cannot be published as-is. Please create an AI draft instead.'))}`)
  const original = r.body_html?.trim() || `<p>${escapeHtml(r.summary ?? '')}</p>`

  let title = r.title
  let excerpt = r.summary ? firstSentences(r.summary) : null
  let body = original
  let aiNotes: string | null = null
  let keywords: string[] = []
  let usedAi = false
  let usedPhotos = 0

  if (mode === 'ai') {
    // 이번 달 AI 사용 한도 확인 (요금제별, 초안·법적 검수 합계). 한도를 다 쓰면 원문 그대로 만들기만 된다
    const slot = await reserveAi(supabase, outletId)
    if (!slot.ok) {
      const msg = slot.scope === 'member'
        ? t(`이번 달 내 AI 사용 한도(${slot.limit}회)를 다 썼습니다. 더 필요하면 편집장에게 한도를 늘려 달라고 요청해 주세요. 원문 그대로 기사 만들기는 쓸 수 있습니다.`, `You have used all of your AI drafts for this month (limit: ${slot.limit}). If you need more, ask your Editor-in-Chief to raise your limit. You can still create a story from the original text as-is.`)
        : aiLimitMessage({ used: slot.used, limit: slot.limit, overage: false })
      redirect(`/press/${id}?error=${encodeURIComponent(msg)}`)
    }
    try {
      const result = await draftFromPressRelease({ title: r.title, text: pressTextForAi(original) || r.summary || '', source: sourceLabel(r), foreign: isForeignSource(r.source_key), us: isUsSource(r.source_key), topic: foreignTopicOf(r.source_key) ?? undefined, link: r.link })
      await finishAi(supabase, slot.id, result)
      const draft = result.draft
      title = draft.title
      excerpt = draft.subtitle || excerpt
      const paras = draft.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`)
      // 원문 사진은 첫 문단 뒤에 그대로 둔다
      // 미국 출처 사진은 기자가 쓸 수 있다고 확인해 체크한 것만 넣는다 (저작권: 체크하지 않은 사진은 기사에 넣지 않는다)
      const picked = (form?.getAll('photo') ?? []).map(String)
      const blocks = photoBlocks(original).filter((b) => !isUsSource(r.source_key) || picked.some((src) => b.includes(`src="${escapeHtml(src)}"`)))
      if (isUsSource(r.source_key) && picked.length) usedPhotos = blocks.length
      body = [paras[0], ...blocks, ...paras.slice(1)].join('')
      aiNotes = draft.review_notes.length ? draft.review_notes.map((n) => `• ${n}`).join('\n') : null
      keywords = draft.keywords ?? []
      usedAi = true
      // 해외 언론: 확인용 원문 주소를 메모에 남긴다 (본문에는 넣지 않는다)
      if (foreign) aiNotes = `${aiNotes ? `${aiNotes}\n` : ''}• ${t('원문', 'Original')}(${sourceLabel(r)}): ${r.link}`
      if (usedPhotos) aiNotes = `${aiNotes ? `${aiNotes}\n` : ''}• ${t(`사진 ${usedPhotos}장은 ${profile?.full_name ?? '기자'}님이 사용 권리를 확인해 넣었습니다. 출처: ${sourceLabel(r)}`, `${usedPhotos} photo(s) were included after ${profile?.full_name ?? 'the reporter'} confirmed the right to use them. Source: ${sourceLabel(r)}`)}`
    } catch (e) {
      // AI가 실패하면 잡아 둔 한 건을 돌려준다 (한도에서 빠진다)
      await releaseAi(supabase, slot.id)
      if (e instanceof AiDraftError) redirect(`/press/${id}?error=${encodeURIComponent(e.message)}`)
      throw e
    }
  }

  // 중복 기사 확인: 같은 보도자료로 만든 기사, 최근 1개월 안의 비슷한 제목 (확인할 점 메모에 남긴다)
  const dup = await duplicateNotes(supabase, outletId, title, r.id).catch(() => [] as string[])
  if (dup.length) aiNotes = `${dup.map((n) => `• ${n}`).join('\n')}${aiNotes ? `\n${aiNotes}` : ''}`

  let thumbnail: string | null = null
  const srcs = Array.from(new Set(Array.from(body.matchAll(/<img[^>]+src="([^"]+)"/g), (m) => m[1]))).slice(0, 6)
  const ours = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`
  for (const src of srcs) {
    // 직접 등록한 보도자료 사진은 이미 우리 저장소에 있다
    const copied = src.startsWith(ours) ? src : await copyImage(supabase, src, outletId)
    if (copied) body = body.split(`src="${src}"`).join(`src="${copied}"`)
    thumbnail ??= copied ?? src
  }

  const { data: outlet } = outletId
    ? await supabase.from('outlets').select('name, site').eq('id', outletId).single()
    : { data: null }
  // 영문 매체는 본문 첫머리 바이라인을 넣지 않는다 (기사 위 "By 이름 - 매체 - 날짜" 줄이 대신한다)
  const englishOutlet = (outlet as { site?: { lang?: string } | null } | null)?.site?.lang === 'en'
  if (!englishOutlet) {
    const byline = `[${outlet?.name ? `${outlet.name}=` : ''}${profile?.full_name ?? ''} 기자]&nbsp;`
    body = body.startsWith('<p>') ? body.replace(/^<p>/, `<p>${byline}`) : `<p>${byline}</p>${body}`
  }
  // AI 활용 표시 (기사 작성 가이드 · 네이버 운영평가 D항): 매체 설정이 켜져 있으면 본문 끝에 붙이고, 아니면 메모로 알린다
  if (usedAi) {
    const notice = aiNoticeText((outlet as { site?: OutletSiteSettings | null } | null)?.site)
    if (notice) body = withAiNotice(body, notice)
    const memo = notice
      ? t('본문 끝에 AI 활용 표시 문구를 넣었습니다(매체 설정). 기사를 거의 새로 썼다면 지워도 됩니다.', 'An AI-use disclosure was added at the end of the story body (outlet setting). You can delete it if you substantially rewrote the story.')
      : t('AI 초안입니다. 거의 그대로 내보낸다면 본문에 AI 활용 사실을 밝혀 주세요(네이버 운영평가 D항). 매체 홈페이지 설정에서 자동 표시를 켤 수 있습니다.', 'This is an AI draft. If you publish it largely as-is, disclose the use of AI in the story body (Naver evaluation item D). You can turn on automatic disclosure in your outlet homepage settings.')
    aiNotes = `${aiNotes ? `${aiNotes}\n` : ''}• ${memo}`
  }

  const row: Record<string, unknown> = {
    title,
    body,
    excerpt,
    thumbnail_url: thumbnail,
    outlet_id: outletId,
    author_id: user.id,
    status: 'draft',
    press_release_id: r.id,
  }
  if (aiNotes) row.ai_notes = aiNotes
  // AI가 뽑은 키워드를 기사 키워드(태그)로 (기사 작성 가이드: 3개 이상)
  if (keywords.length) row.tags = keywords

  let { data: article, error } = await supabase.from('articles').insert(row).select('id').single()
  // ai-draft.sql 실행 전이면 메모 칸이 없으므로 메모 없이 저장한다
  if (error && aiNotes && /ai_notes/.test(error.message)) {
    delete row.ai_notes
    ;({ data: article, error } = await supabase.from('articles').insert(row).select('id').single())
  }
  if (error || !article) redirect(`/press/${id}?error=${encodeURIComponent(`${t('기사를 만들지 못했습니다', 'Could not create the story')}: ${error?.message ?? ''}`)}`)

  redirect(`/articles/${article.id}/edit`)
}

// 보도자료 여러 건을 AI로 기사로 만들어 "승인대기"로 보낸다 (한 건씩 부른다. 화면이 순서대로 불러 진행 상황을 보여 준다)
//   기사 하나를 만드는 기존 흐름(createArticleFromPress 'ai')과 같은 규칙: 이번 달 AI 한도, 중복 확인, AI 활용 표시, 바이라인.
//   사진은 언론이 쓰라고 내는 자료(정부·지자체, 뉴스와이어)의 원문 사진만 넣고, 해외·미국 언론 사진은 넣지 않는다 (사용 권리를 확인하지 못하면 넣지 않는다).
//   법적 검수는 하지 않는다 (기사를 열어 AI 법적 검수를 누르거나 편집장이 승인할 때 확인) — 확인할 점 메모에 남긴다
export type BulkResult = { ok: boolean; id: string; title?: string; articleId?: string; error?: string; stop?: boolean }
export async function createAiReviewArticle(id: string, length?: number): Promise<BulkResult> {
  const { supabase, user, profile, outletId } = await getCmsContext()
  const { t } = await getT()
  if (!outletId) return { ok: false, id, error: t('매체를 먼저 골라 주세요.', 'Choose an outlet first.'), stop: true }
  const { data } = await supabase.from('press_releases').select('*').eq('id', id).maybeSingle()
  if (!data) return { ok: false, id, error: t('보도자료를 찾을 수 없습니다.', 'Press release not found.') }
  const { data: dupRow } = await supabase.from('articles').select('id').eq('outlet_id', outletId).eq('press_release_id', id).limit(1)
  if (dupRow?.length) return { ok: false, id, title: (data as PressRelease).title, error: t('이미 기사로 만든 보도자료입니다.', 'A story was already created from this release.') }
  // 글이 짧거나 사진이 없다고 판정된 자료(품질 미달)는 AI 기사로 만들지 않는다 (직접 등록·메일 자료는 해당 없음)
  if ((data as PressRelease).quality === 'poor') return { ok: false, id, title: (data as PressRelease).title, error: t('글이 짧거나 사진이 없어 기사로 만들기에 부족한 자료입니다.', 'This release is too short or has no photo to build a story from.') }
  const r = await ensureFullBody(supabase, data as PressRelease)
  const original = r.body_html?.trim() || `<p>${escapeHtml(r.summary ?? '')}</p>`

  const slot = await reserveAi(supabase, outletId)
  if (!slot.ok) {
    const msg = slot.scope === 'member'
      ? t(`이번 달 내 AI 사용 한도(${slot.limit}회)를 다 썼습니다.`, `You have used all of your AI drafts for this month (limit: ${slot.limit}).`)
      : aiLimitMessage({ used: slot.used, limit: slot.limit, overage: false })
    return { ok: false, id, title: r.title, error: msg, stop: true }
  }
  const { data: catRows } = await supabase.from('categories').select('id, name').eq('outlet_id', outletId)
  const cats = (catRows ?? []) as { id: string; name: string }[]
  let draft
  try {
    const result = await draftFromPressRelease({ title: r.title, text: pressTextForAi(original) || r.summary || '', source: sourceLabel(r), foreign: isForeignSource(r.source_key), us: isUsSource(r.source_key), topic: foreignTopicOf(r.source_key) ?? undefined, link: r.link, categories: cats.map((c) => c.name), length: length === 800 || length === 1000 || length === 1500 ? length : undefined })
    await finishAi(supabase, slot.id, result)
    draft = result.draft
  } catch (e) {
    await releaseAi(supabase, slot.id)
    return { ok: false, id, title: r.title, error: e instanceof AiDraftError ? e.message : t('AI 기사 작성에 실패했습니다.', 'AI drafting failed.') }
  }

  const kind = findPressSource(r.source_key)?.kind
  const photosOk = !isForeignSource(r.source_key) && (kind === 'gov' || kind === 'newswire')
  const paras = draft.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`)
  const blocks = photosOk ? photoBlocks(original) : []
  let body = [paras[0], ...blocks, ...paras.slice(1)].join('')
  let thumbnail: string | null = null
  const srcs = Array.from(new Set(Array.from(body.matchAll(/<img[^>]+src="([^"]+)"/g), (m) => m[1]))).slice(0, 4)
  const ours = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`
  for (const src of srcs) {
    const copied = src.startsWith(ours) ? src : await copyImage(supabase, src, outletId)
    if (copied) body = body.split(`src="${src}"`).join(`src="${copied}"`)
    thumbnail ??= copied ?? src
  }

  const { data: outlet } = await supabase.from('outlets').select('name, site').eq('id', outletId).single()
  const englishOutlet = (outlet as { site?: { lang?: string } | null } | null)?.site?.lang === 'en'
  if (!englishOutlet) {
    const byline = `[${outlet?.name ? `${outlet.name}=` : ''}${profile?.full_name ?? ''} 기자]&nbsp;`
    body = body.startsWith('<p>') ? body.replace(/^<p>/, `<p>${byline}`) : `<p>${byline}</p>${body}`
  }
  const notice = aiNoticeText((outlet as { site?: OutletSiteSettings | null } | null)?.site)
  if (notice) body = withAiNotice(body, notice)

  const picked = draft.category ? cats.find((c) => c.name === draft.category) : undefined
  const notes: string[] = []
  const dup = await duplicateNotes(supabase, outletId, draft.title, r.id).catch(() => [] as string[])
  notes.push(...dup.map((n) => `• ${n}`))
  if (draft.review_notes.length) notes.push(...draft.review_notes.map((n) => `• ${n}`))
  if (picked) notes.push(`• ${t(`섹션 "${picked.name}"은 AI가 고른 것입니다. 맞지 않으면 승인 전에 바꿔 주세요.`, `The section "${picked.name}" was chosen by AI. Change it before approving if it does not fit.`)}`)
  notes.push(`• ${t('보도자료함에서 일괄로 만든 AI 초안입니다. AI 법적 검수는 아직 하지 않았으니, 기사를 열어 검수한 뒤 승인해 주세요.', 'Bulk AI draft from the press inbox. The AI legal review has not been run; open the story and run it before approving.')}`)
  notes.push(`• ${t('원문', 'Original')}(${sourceLabel(r)}): ${r.link}`)
  notes.push(`• ${notice ? t('본문 끝에 AI 활용 표시 문구를 넣었습니다(매체 설정).', 'An AI-use disclosure was added at the end of the story (outlet setting).') : t('AI 초안입니다. 거의 그대로 내보낸다면 본문에 AI 활용 사실을 밝혀 주세요.', 'This is an AI draft. If you publish it largely as-is, disclose the use of AI in the story body.')}`)

  const row: Record<string, unknown> = {
    title: draft.title,
    body,
    excerpt: draft.subtitle || (r.summary ? firstSentences(r.summary) : null),
    thumbnail_url: thumbnail,
    outlet_id: outletId,
    author_id: user.id,
    status: 'in_review',
    press_release_id: r.id,
    ai_notes: notes.join('\n'),
  }
  if (draft.keywords?.length) row.tags = draft.keywords
  // 섹션: AI가 고른 섹션을 넣는다 (맞는 게 없으면 비움). 승인할 때 편집장이 바꿀 수 있다
  if (picked) row.category_id = picked.id
  let { data: article, error } = await supabase.from('articles').insert(row).select('id').single()
  if (error && /ai_notes/.test(error.message)) {
    delete row.ai_notes
    ;({ data: article, error } = await supabase.from('articles').insert(row).select('id').single())
  }
  if (error || !article) return { ok: false, id, title: draft.title, error: `${t('기사를 저장하지 못했습니다', 'Could not save the story')}: ${error?.message ?? ''}` }
  revalidatePath('/articles')
  return { ok: true, id, title: draft.title, articleId: article.id }
}

export type ManualPressState = { error?: string }

// 이메일 등으로 받은 보도자료를 기자가 붙여넣어 보도자료함에 올린다
export async function createManualPress(_prev: ManualPressState, form: FormData): Promise<ManualPressState> {
  const { supabase } = await getCmsContext()
  const { t } = await getT()
  const get = (k: string) => String(form.get(k) ?? '').trim()

  const sourceName = get('source_name').slice(0, 80)
  const title = get('title').slice(0, 300)
  const paras = textToParagraphs(get('body').slice(0, 50_000))
  let link = get('link').slice(0, 1000)
  if (!sourceName) return { error: t('보낸 곳(기관·회사명)을 적어주세요.', 'Enter the sender (organization or company name).') }
  if (!title) return { error: t('제목을 적어주세요.', 'Enter a title.') }
  if (!paras.length) return { error: t('본문을 붙여넣어 주세요.', 'Paste the body text.') }
  if (link && !/^https?:\/\//i.test(link)) link = `https://${link}`

  // 사진은 이 화면에서 우리 저장소에 먼저 올린 것만 받는다
  const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`
  const urls = form.getAll('photo_url').map(String)
  const captions = form.getAll('photo_caption').map((c) => String(c).trim().slice(0, 200))
  const photos = urls
    .map((src, i) => ({ src, caption: captions[i] ?? '' }))
    .filter((p) => p.src.startsWith(storagePrefix))
    .slice(0, 10)
    .map((p) => `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.caption)}">` + (p.caption ? `<p><em>▲ ${escapeHtml(p.caption)}</em></p>` : ''))

  const body = paras.map((p) => `<p>${escapeHtml(p)}</p>`)
  const bodyHtml = [body[0], ...photos, ...body.slice(1)].join('')

  const { data, error } = await supabase
    .from('press_releases')
    .insert({
      source_key: MANUAL_SOURCE,
      source_name: sourceName,
      guid: `${MANUAL_SOURCE}:${crypto.randomUUID()}`,
      title,
      link,
      summary: paras.join(' ').slice(0, 400),
      body_html: bodyHtml,
      image_url: urls.find((u) => u.startsWith(storagePrefix)) ?? null,
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) return { error: `${t('등록하지 못했습니다', 'Could not add the press release')}: ${error?.message ?? ''}` }

  revalidatePath('/press')
  redirect(`/press/${data.id}`)
}

export async function deleteManualPress(id: string) {
  const { supabase } = await getCmsContext()
  const { t } = await getT()
  // 직접 등록하거나 메일로 받은 자료만, 올린 본인이 지울 수 있다 (DB 규칙도 같다)
  const { data, error } = await supabase.from('press_releases').delete().eq('id', id).in('source_key', [MANUAL_SOURCE, 'email']).select('source_key')
  if (error || !data?.length) redirect(`/press/${id}?error=${encodeURIComponent(`${t('삭제하지 못했습니다', 'Could not delete')}: ${error?.message ?? t('권한이 없습니다.', 'You do not have permission.')}`)}`)
  revalidatePath('/press')
  redirect(`/press?src=${data[0].source_key}`)
}
