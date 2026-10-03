'use server'

import { getCmsContext } from '@/lib/cms'
import { downloadUrl, photoCredit, searchOpenPhotos, type PhotoHit } from '@/lib/photo-search'

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const LICENSES = ['cc0', 'pdm', 'by', 'by-sa']

// 추천 사진 찾기 (편집국 회원만)
export async function findPhotos(query: string): Promise<{ hits?: PhotoHit[]; error?: string }> {
  await getCmsContext()
  try {
    return { hits: await searchOpenPhotos(query) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '사진을 찾지 못했습니다.' }
  }
}

// 고른 사진을 우리 저장소로 가져온다. 화면이 보낸 주소를 믿지 않고 Openverse에서 라이선스를 다시 확인한다
export async function importPhoto(id: string): Promise<{ url?: string; caption?: string; page?: string; error?: string }> {
  const { supabase, outletId } = await getCmsContext()
  if (!/^[0-9a-f-]{36}$/.test(id)) return { error: '사진을 찾지 못했습니다.' }
  try {
    const meta = await fetch(`https://api.openverse.org/v1/images/${id}/`, { headers: { 'User-Agent': 'IMNewsroom/1.0 (https://imcms.vercel.app)' }, cache: 'no-store' })
    if (!meta.ok) return { error: '사진 정보를 확인하지 못했습니다.' }
    const r = (await meta.json()) as any
    if (!LICENSES.includes(r.license)) return { error: '이 사진은 라이선스 조건이 맞지 않아 가져올 수 없습니다.' }
    const license = r.license === 'cc0' ? 'CC0' : r.license === 'pdm' ? '퍼블릭 도메인' : `CC ${String(r.license).toUpperCase()}${r.license_version ? ` ${r.license_version}` : ''}`
    const caption = photoCredit({ creator: String(r.creator ?? ''), source: String(r.source ?? r.provider ?? ''), license })

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    let res = await fetch(downloadUrl(String(r.url)), { signal: ctrl.signal, cache: 'no-store', headers: { 'User-Agent': 'IMNewsroom/1.0 (https://imcms.vercel.app)' } })
    if (!res.ok && downloadUrl(String(r.url)) !== String(r.url)) res = await fetch(String(r.url), { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    const ext = TYPES[type]
    if (!res.ok || !ext) return { error: '사진 파일을 받지 못했습니다. 다른 사진을 골라 주세요.' }
    const bytes = await res.arrayBuffer()
    if (bytes.byteLength > 12 * 1024 * 1024) return { error: '사진 파일이 너무 큽니다(12MB 넘음). 다른 사진을 골라 주세요.' }
    const now = new Date()
    const path = `${outletId ?? 'common'}/open/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType: type, cacheControl: '31536000' })
    if (error) return { error: `저장하지 못했습니다: ${error.message}` }
    return { url: supabase.storage.from('media').getPublicUrl(path).data.publicUrl, caption, page: String(r.foreign_landing_url ?? '') }
  } catch (e) {
    return { error: e instanceof Error && e.name === 'AbortError' ? '사진을 받는 데 시간이 오래 걸립니다. 다시 시도해 주세요.' : '사진을 가져오지 못했습니다.' }
  }
}
