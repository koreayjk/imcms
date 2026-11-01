// 위키미디어 공용(Commons)에서 상업 이용이 가능한 공개 라이선스 사진 찾기 (자동 기사용)
//   Openverse 는 익명 호출 한도가 낮아(시간당 수 건) 8개 매체가 같은 시각에 쓰면 막힌다. 공용 API 는 한도가 넉넉하다
//   허용: CC0 · 퍼블릭 도메인 · CC BY · CC BY-SA   (NC·ND·Fair use 제외)
//   요청 헤더에는 서비스 주소만 쓰고 개인정보(이메일 등)는 넣지 않는다. 서버에서만 쓴다

export type CommonsPhoto = { src: string; caption: string; page: string; title: string }

const UA = 'IMNewsroom/1.0 (https://imcms.vercel.app)'
const OK_LICENSE = /^(cc0|cc[- ]?zero|public domain|pd\b|pdm|cc[- ]by(?:[- ]sa)?[- ]\d)/i
const BAD_TITLE = /logo|flag|map\b|diagram|icon|symbol|coat of arms|portrait|signature|screenshot|poster|\.svg/i

const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim()

async function getJson(url: string, ms = 9000): Promise<{ status: number; json: any }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: ctrl.signal, cache: 'no-store' })
    return { status: res.status, json: res.ok ? await res.json().catch(() => null) : null }
  } finally {
    clearTimeout(timer)
  }
}

// seed: 같은 검색어라도 기사마다 다른 사진이 고르도록 고르는 위치를 흩뜨린다
export async function searchCommons(query: string, lang: 'ko' | 'en', seed = 0): Promise<CommonsPhoto | null> {
  const q = query.trim().slice(0, 80)
  if (!q) return null
  const params = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '20',
    gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280', origin: '*',
  })
  const url = `https://commons.wikimedia.org/w/api.php?${params}`
  let r = await getJson(url)
  if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 1500)); r = await getJson(url) }
  if (!r.json) throw new Error(`위키미디어 검색 실패(${r.status})`)
  const pages = Object.values((r.json.query?.pages ?? {}) as Record<string, any>)
  const hits: CommonsPhoto[] = []
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime ?? '')) continue
    if ((ii.width ?? 0) < 1000 || (ii.height ?? 0) < 500) continue
    const title = String(p.title ?? '').replace(/^File:/, '')
    if (BAD_TITLE.test(title)) continue
    const meta = ii.extmetadata ?? {}
    const license = strip(String(meta.LicenseShortName?.value ?? ''))
    if (!OK_LICENSE.test(license) || /nc|nd|fair/i.test(license) || String(meta.NonFree?.value ?? '') === 'true') continue
    const author = strip(String(meta.Artist?.value ?? '')).slice(0, 60) || (lang === 'en' ? 'Unknown photographer' : '작가 미상')
    const src = String(ii.thumburl ?? ii.url ?? '')
    if (!/^https:\/\//.test(src)) continue
    hits.push({
      src, title, page: String(ii.descriptionurl ?? ''),
      caption: lang === 'en' ? `Photo: ${author}, Wikimedia Commons (${license})` : `사진=${author}, 위키미디어 공용 (${license})`,
    })
  }
  if (!hits.length) return null
  return hits[Math.abs(seed) % hits.length]
}
