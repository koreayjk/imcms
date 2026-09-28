'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCmsContext } from '@/lib/cms'
import { ensureFullBody, refreshPress, sourceLabel, type PressRelease } from '@/lib/press'

const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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

export async function createArticleFromPress(id: string) {
  const { supabase, user, profile, outletId } = await getCmsContext()

  const { data } = await supabase.from('press_releases').select('*').eq('id', id).single()
  if (!data) throw new Error('보도자료를 찾을 수 없습니다.')
  const r = await ensureFullBody(supabase, data as PressRelease)

  const { data: outlet } = outletId
    ? await supabase.from('outlets').select('name').eq('id', outletId).single()
    : { data: null }

  let body = r.body_html?.trim() || `<p>${escapeHtml(r.summary ?? '')}</p>`

  let thumbnail: string | null = null
  const srcs = Array.from(new Set(Array.from(body.matchAll(/<img[^>]+src="([^"]+)"/g), (m) => m[1]))).slice(0, 6)
  for (const src of srcs) {
    const copied = await copyImage(supabase, src, outletId)
    if (copied) body = body.split(`src="${src}"`).join(`src="${copied}"`)
    thumbnail ??= copied ?? src
  }

  const byline = `[${outlet?.name ? `${outlet.name}=` : ''}${profile?.full_name ?? ''} 기자]&nbsp;`
  body = body.startsWith('<p>') ? body.replace(/^<p>/, `<p>${byline}`) : `<p>${byline}</p>${body}`
  body += `<p><em>※ 이 기사는 ${sourceLabel(r.source_key)}에서 배포한 보도자료를 바탕으로 작성됐습니다.</em></p>`

  const { data: article, error } = await supabase
    .from('articles')
    .insert({
      title: r.title,
      body,
      excerpt: r.summary ? firstSentences(r.summary) : null,
      thumbnail_url: thumbnail,
      outlet_id: outletId,
      author_id: user.id,
      status: 'draft',
      press_release_id: r.id,
    })
    .select('id')
    .single()
  if (error || !article) throw new Error(`기사를 만들지 못했습니다: ${error?.message ?? ''}`)

  redirect(`/articles/${article.id}/edit`)
}
