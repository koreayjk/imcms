import type { SupabaseClient } from '@supabase/supabase-js'
import type { PressRelease } from './press'

export type PressAttachment = { id: string; name: string; content_type: string; size: number; copied_url: string | null }

// PostgREST는 bytea를 "\x0a1b…" 16진수 문자열로 돌려준다
export function byteaToBytes(v: unknown): Uint8Array {
  if (typeof v !== 'string') return new Uint8Array()
  const hex = v.startsWith('\\x') ? v.slice(2) : v
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16)
  return out
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// 메일로 받은 보도자료: 첨부 사진을 처음 열 때 사진 저장소로 옮기고 본문 첫 문단 뒤에 넣는다
export async function ensureEmailImages(supabase: SupabaseClient, r: PressRelease, outletId: string | null) {
  if (r.source_key !== 'email') return { release: r, attachments: [] as PressAttachment[] }

  const { data: list, error } = await supabase
    .from('press_attachments').select('id, name, content_type, size, copied_url').eq('press_release_id', r.id).order('created_at')
  if (error || !list) return { release: r, attachments: [] as PressAttachment[] }

  const pending = list.filter((a) => EXT[a.content_type] && !a.copied_url)
  if (!pending.length) return { release: r, attachments: list as PressAttachment[] }

  const added: string[] = []
  for (const a of pending) {
    const { data: row } = await supabase.from('press_attachments').select('data').eq('id', a.id).single()
    const bytes = byteaToBytes(row?.data)
    if (!bytes.length) continue
    const now = new Date()
    const path = `${outletId ?? 'common'}/press/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${EXT[a.content_type]}`
    const { error: upErr } = await supabase.storage.from('media').upload(path, bytes, { contentType: a.content_type, cacheControl: '31536000' })
    if (upErr) continue
    const url = supabase.storage.from('media').getPublicUrl(path).data.publicUrl
    // 다른 사람이 먼저 옮겼으면 건너뛴다
    const { data: claimed } = await supabase.from('press_attachments').update({ copied_url: url, data: null }).eq('id', a.id).is('copied_url', null).select('id')
    if (!claimed?.length) continue
    a.copied_url = url
    added.push(`<img src="${url}" alt="">`)
  }
  if (!added.length) return { release: r, attachments: list as PressAttachment[] }

  const body = r.body_html ?? ''
  const cut = body.indexOf('</p>')
  const next = cut >= 0 ? body.slice(0, cut + 4) + added.join('') + body.slice(cut + 4) : added.join('') + body
  const image = r.image_url ?? list.find((a) => a.copied_url)?.copied_url ?? null
  await supabase.from('press_releases').update({ body_html: next, image_url: image }).eq('id', r.id)
  return { release: { ...r, body_html: next, image_url: image }, attachments: list as PressAttachment[] }
}
