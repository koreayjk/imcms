import type { SupabaseClient } from '@supabase/supabase-js'
import type { PressRelease } from './press'
import { isImageAttachment } from './press-email'
import { escapeHtml, textToParagraphs } from './press'
import { extractAttachment, isReadableDoc } from './press-extract'

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
// 메일 프로그램이 image/jpg·octet-stream 등으로 보낸 사진도 확장자로 알아본다
function imageType(a: { content_type: string; name: string }): string | null {
  if (EXT[a.content_type]) return a.content_type
  if (!isImageAttachment(a.content_type, a.name)) return null
  const ext = a.name.toLowerCase().match(/\.(jpe?g|png|webp|gif)$/)?.[1] ?? (/png/i.test(a.content_type) ? 'png' : 'jpeg')
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' } as Record<string, string>)[ext] ?? null
}

// 메일로 받은 보도자료: 첨부 사진을 처음 열 때 사진 저장소로 옮기고 본문 첫 문단 뒤에 넣는다
export async function ensureEmailImages(supabase: SupabaseClient, r: PressRelease, outletId: string | null) {
  if (r.source_key !== 'email') return { release: r, attachments: [] as PressAttachment[] }

  const { data: list, error } = await supabase
    .from('press_attachments').select('id, name, content_type, size, copied_url').eq('press_release_id', r.id).order('created_at')
  if (error || !list) return { release: r, attachments: [] as PressAttachment[] }

  const pending = list.filter((a) => imageType(a) && !a.copied_url)
  if (!pending.length) return { release: r, attachments: list as PressAttachment[] }

  const added: string[] = []
  for (const a of pending) {
    const { data: row } = await supabase.from('press_attachments').select('data').eq('id', a.id).single()
    const bytes = byteaToBytes(row?.data)
    if (!bytes.length) continue
    const now = new Date()
    const type = imageType(a)!
    const path = `${outletId ?? 'common'}/press/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${EXT[type]}`
    const { error: upErr } = await supabase.storage.from('media').upload(path, bytes, { contentType: type, cacheControl: '31536000' })
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
  const image = r.image_url || (list.find((a) => a.copied_url)?.copied_url ?? null)
  await supabase.from('press_releases').update({ body_html: next, image_url: image }).eq('id', r.id)
  return { release: { ...r, body_html: next, image_url: image }, attachments: list as PressAttachment[] }
}


// 스탠다드 요금제부터: 한글·워드·PDF·텍스트 첨부의 글자를 처음 열 때 보도자료 본문 아래에 넣는다 (한 번만, 읽지 못하면 이유만 남긴다)
//   press-email-text.sql 을 아직 실행하지 않았으면 조용히 건너뛴다
export async function ensureEmailText(supabase: SupabaseClient, r: PressRelease, attachments: PressAttachment[]) {
  if (r.source_key !== 'email') return { release: r, notes: [] as string[] }
  const docs = attachments.filter((a) => !imageType(a) && isReadableDoc(a.name))
  if (!docs.length) return { release: r, notes: [] as string[] }

  const { data: flags, error } = await supabase.from('press_attachments').select('id, text_done').in('id', docs.map((a) => a.id))
  if (error || !flags) return { release: r, notes: [] as string[] }
  const todo = docs.filter((a) => flags.find((f) => f.id === a.id && f.text_done === false))
  const notes: string[] = []
  const blocks: string[] = []
  let firstText = ''
  for (const a of todo) {
    // 다른 사람이 먼저 읽고 있으면 건너뛴다
    const { data: claimed } = await supabase.from('press_attachments').update({ text_done: true }).eq('id', a.id).eq('text_done', false).select('data')
    if (!claimed?.length) continue
    const bytes = byteaToBytes(claimed[0].data)
    if (!bytes.length) continue
    const got = await extractAttachment(a.name, bytes)
    if ('note' in got) { notes.push(`${a.name}: ${got.note}`); continue }
    const paras = textToParagraphs(got.text)
    firstText ||= paras.join(' ')
    blocks.push(`<hr><p><strong>첨부파일 내용 (${escapeHtml(a.name)})</strong></p>${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}`)
  }
  if (!blocks.length) return { release: r, notes }

  const base = (r.body_html ?? '').replace('<p>(본문 없음 — 첨부파일을 확인하세요)</p>', '')
  const next = base + blocks.join('')
  const summary = r.summary?.trim() ? r.summary : firstText.slice(0, 300)
  await supabase.from('press_releases').update({ body_html: next, summary }).eq('id', r.id)
  return { release: { ...r, body_html: next, summary }, notes }
}
