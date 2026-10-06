'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCmsContext } from '@/lib/cms'
import { foreignTopicOf, isForeignSource } from '@/lib/press-sources'
import { MANUAL_SOURCE, ensureFullBody, escapeHtml, htmlToText, refreshPress, sourceLabel, textToParagraphs, type PressRelease } from '@/lib/press'
import { AiDraftError, draftFromPressRelease } from '@/lib/ai-draft'
import { aiLimitMessage, finishAi, releaseAi, reserveAi } from '@/lib/ai-usage'

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export async function refreshNow() {
  const { supabase } = await getCmsContext()
  await refreshPress(supabase, true)
  revalidatePath('/press')
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
}

export async function createArticleFromPress(id: string, mode: 'raw' | 'ai') {
  const { supabase, user, profile, outletId } = await getCmsContext()

  const { data } = await supabase.from('press_releases').select('*').eq('id', id).single()
  if (!data) throw new Error('보도자료를 찾을 수 없습니다.')
  const r = await ensureFullBody(supabase, data as PressRelease)
  // 해외 언론 기사는 그 언론사 저작물이라 원문 그대로 올리지 않는다 (AI가 출처를 밝힌 한국어 기사로 새로 쓴다)
  const foreign = isForeignSource(r.source_key)
  if (foreign && mode === 'raw') redirect(`/press/${id}?error=${encodeURIComponent('해외 언론 기사는 원문 그대로 올릴 수 없습니다. AI 기사로 만들어 주세요.')}`)
  const original = r.body_html?.trim() || `<p>${escapeHtml(r.summary ?? '')}</p>`

  let title = r.title
  let excerpt = r.summary ? firstSentences(r.summary) : null
  let body = original
  let aiNotes: string | null = null

  if (mode === 'ai') {
    // 이번 달 AI 사용 한도 확인 (요금제별, 초안·법적 검수 합계). 한도를 다 쓰면 원문 그대로 만들기만 된다
    const slot = await reserveAi(supabase, outletId)
    if (!slot.ok) {
      const msg = slot.scope === 'member'
        ? `이번 달 내 AI 사용 한도(${slot.limit}회)를 다 썼습니다. 더 필요하면 편집장에게 한도를 늘려 달라고 요청해 주세요. 원문 그대로 기사 만들기는 쓸 수 있습니다.`
        : aiLimitMessage({ used: slot.used, limit: slot.limit, overage: false })
      redirect(`/press/${id}?error=${encodeURIComponent(msg)}`)
    }
    try {
      const result = await draftFromPressRelease({ title: r.title, text: htmlToText(original) || r.summary || '', source: sourceLabel(r), foreign: isForeignSource(r.source_key), topic: foreignTopicOf(r.source_key) ?? undefined, link: r.link })
      await finishAi(supabase, slot.id, result)
      const draft = result.draft
      title = draft.title
      excerpt = draft.subtitle || excerpt
      const paras = draft.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`)
      // 원문 사진은 첫 문단 뒤에 그대로 둔다
      body = [paras[0], ...photoBlocks(original), ...paras.slice(1)].join('')
      aiNotes = draft.review_notes.length ? draft.review_notes.map((n) => `• ${n}`).join('\n') : null
      // 해외 언론: 확인용 원문 주소를 메모에 남긴다 (본문에는 넣지 않는다)
      if (foreign) aiNotes = `${aiNotes ? `${aiNotes}\n` : ''}• 원문(${sourceLabel(r)}): ${r.link}`
    } catch (e) {
      // AI가 실패하면 잡아 둔 한 건을 돌려준다 (한도에서 빠진다)
      await releaseAi(supabase, slot.id)
      if (e instanceof AiDraftError) redirect(`/press/${id}?error=${encodeURIComponent(e.message)}`)
      throw e
    }
  }

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
    ? await supabase.from('outlets').select('name').eq('id', outletId).single()
    : { data: null }
  const byline = `[${outlet?.name ? `${outlet.name}=` : ''}${profile?.full_name ?? ''} 기자]&nbsp;`
  body = body.startsWith('<p>') ? body.replace(/^<p>/, `<p>${byline}`) : `<p>${byline}</p>${body}`

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

  let { data: article, error } = await supabase.from('articles').insert(row).select('id').single()
  // ai-draft.sql 실행 전이면 메모 칸이 없으므로 메모 없이 저장한다
  if (error && aiNotes && /ai_notes/.test(error.message)) {
    delete row.ai_notes
    ;({ data: article, error } = await supabase.from('articles').insert(row).select('id').single())
  }
  if (error || !article) redirect(`/press/${id}?error=${encodeURIComponent(`기사를 만들지 못했습니다: ${error?.message ?? ''}`)}`)

  redirect(`/articles/${article.id}/edit`)
}

export type ManualPressState = { error?: string }

// 이메일 등으로 받은 보도자료를 기자가 붙여넣어 보도자료함에 올린다
export async function createManualPress(_prev: ManualPressState, form: FormData): Promise<ManualPressState> {
  const { supabase } = await getCmsContext()
  const get = (k: string) => String(form.get(k) ?? '').trim()

  const sourceName = get('source_name').slice(0, 80)
  const title = get('title').slice(0, 300)
  const paras = textToParagraphs(get('body').slice(0, 50_000))
  let link = get('link').slice(0, 1000)
  if (!sourceName) return { error: '보낸 곳(기관·회사명)을 적어주세요.' }
  if (!title) return { error: '제목을 적어주세요.' }
  if (!paras.length) return { error: '본문을 붙여넣어 주세요.' }
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
  if (error || !data) return { error: `등록하지 못했습니다: ${error?.message ?? ''}` }

  revalidatePath('/press')
  redirect(`/press/${data.id}`)
}

export async function deleteManualPress(id: string) {
  const { supabase } = await getCmsContext()
  // 직접 등록하거나 메일로 받은 자료만, 올린 본인이 지울 수 있다 (DB 규칙도 같다)
  const { data, error } = await supabase.from('press_releases').delete().eq('id', id).in('source_key', [MANUAL_SOURCE, 'email']).select('source_key')
  if (error || !data?.length) redirect(`/press/${id}?error=${encodeURIComponent(`삭제하지 못했습니다: ${error?.message ?? '권한이 없습니다.'}`)}`)
  revalidatePath('/press')
  redirect(`/press?src=${data[0].source_key}`)
}
