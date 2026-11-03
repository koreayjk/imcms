// 지자체 보도자료 수집 (안산시 홈페이지, 경기도뉴스포털의 경기도·시군 보도자료)
//   RSS가 없거나 인증키가 필요한 곳이라 게시판 목록 페이지를 읽는다. 목록은 제목·담당부서·날짜·상세 주소를, 상세는 본문 문단과 사진을 돌려준다.
//   서버(수집 크론·보도자료 열기)에서만 쓴다. 요청은 매시간 몇 번뿐이고, 로그인·차단 우회는 하지 않는다 (막히면 그 출처는 건너뛴다)
import type { PressRow } from './press'

export type LocalKind = 'ansan' | 'gnews'

const decode = (s: string) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&hellip;/g, '…').replace(/&lsquo;|&rsquo;/g, "'").replace(/&ldquo;|&rdquo;/g, '"').replace(/&middot;/g, '·')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
const text = (html: string) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// '2026-11-03' / '2026.11.03' → 한국 시간 정오(날짜만 있는 글은 시각을 정오로 둔다)
function kstDate(s: string): string | null {
  const m = /(\d{4})[-.](\d{2})[-.](\d{2})/.exec(s)
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+09:00`).toISOString() : null
}

// 본문 HTML → 문단 (<p>·줄바꿈 단위). 글꼴·색 같은 꾸밈은 모두 버린다
function paragraphs(inner: string): string[] {
  const cleaned = inner.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '')
  const parts = /<p[\s>]/i.test(cleaned)
    ? Array.from(cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi), (m) => m[1])
    : cleaned.split(/<br\s*\/?>|\n\s*\n/i)
  return parts.map((p) => text(p)).filter((p) => p.length > 1)
}

function build(paras: string[], images: { src: string; alt?: string }[], credit: string) {
  const ps = paras.map((p) => `<p>${esc(p)}</p>`)
  const pics = images.slice(0, 4).map((i) => `<img src="${esc(i.src)}" alt=""><p><em>▲ ${esc(i.alt?.trim() || `사진=${credit} 제공`)}</em></p>`)
  const html = [ps[0], ...pics, ...ps.slice(1)].filter(Boolean).join('')
  return { html, image: images[0]?.src ?? '' }
}

// ───────── 안산시 홈페이지 (보도자료 bbs_code=B0238) ─────────
const ANSAN = 'https://www.ansan.go.kr'

export function parseAnsanList(page: string, code = 'B0238', label = '안산시'): PressRow[] {
  const rows: PressRow[] = []
  for (const tr of page.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1]
    const a = /fnGoDetail\(\s*(\d+)\s*\)[^>]*>([\s\S]*?)<\/a>/i.exec(b)
    if (!a) continue
    const title = text(a[2])
    const date = kstDate(/data-field=['"]REGIST_DT['"][^>]*>([\s\S]*?)<\/td>/i.exec(b)?.[1] ?? '')
    const dept = text(/data-field=['"]ADITFIELD1['"][^>]*>([\s\S]*?)<\/td>/i.exec(b)?.[1] ?? '')
    if (!title) continue
    const link = `${ANSAN}/www/common/bbs/selectBbsDetail.do?bbs_code=${code}&bbs_seq=${a[1]}`
    rows.push({ source_key: 'lg-ansan', source_name: `${label} 보도자료`, guid: `lg-ansan:${code}:${a[1]}`, title, link, summary: dept ? `담당부서: ${dept}` : null, body_html: null, published_at: date })
  }
  return rows
}

export function parseAnsanDetail(page: string, label = '안산시') {
  const cell = /<th[^>]*>\s*내용\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i.exec(page)?.[1] ?? ''
  if (!cell) return null
  const images = Array.from(cell.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi), (m) => ({ src: new URL(decode(m[1]), ANSAN).toString() })).filter((i) => !/ico|btn|icon/i.test(i.src))
  const uniq = images.filter((i, n) => images.findIndex((x) => x.src === i.src) === n)
  const paras = paragraphs(cell.replace(/<div class="p-photo[\s\S]*?<\/div>\s*<\/div>/gi, ''))
  return paras.length ? build(paras, uniq, label) : null
}

// ───────── 경기도뉴스포털 (경기도·시군 보도자료) ─────────
const GNEWS = 'https://gnews.gg.go.kr'

export function parseGnewsList(page: string, key: string, label: string): PressRow[] {
  const rows: PressRow[] = []
  for (const tr of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1]
    const a = /<a[^>]+href="([^"]*brief_gongbo_view\.do[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(b)
    if (!a) continue
    const href = decode(a[1])
    const bs = /BS_CODE=([A-Za-z0-9]+)/.exec(href)?.[1]
    const no = /number=(\d+)/.exec(href)?.[1]
    const title = text(a[2])
    if (!bs || !no || !title) continue
    const dept = text(/<td class="dp[^"]*"[^>]*>([\s\S]*?)<\/td>/i.exec(b)?.[1] ?? '')
    const date = kstDate(/<td class="date"[^>]*>([\s\S]*?)<\/td>/i.exec(b)?.[1] ?? '')
    rows.push({
      source_key: key, source_name: `${dept || label} 보도자료(경기도뉴스포털)`, guid: `${key}:${bs}:${no}`, title,
      link: `${GNEWS}/briefing/brief_gongbo_view.do?BS_CODE=${bs}&number=${no}`, summary: dept ? `담당부서: ${dept}` : null, body_html: null, published_at: date,
    })
  }
  return rows
}

export function parseGnewsDetail(page: string, label = '경기도뉴스포털') {
  const i = page.indexOf('class="postbody"')
  if (i < 0) return null
  // 본문은 postbody 안의 postBody. 첨부(사진 목록)가 시작되기 전까지만 본문으로 본다
  let zone = page.slice(i, i + 200000)
  const cut = zone.search(/fileset26|class="postmenu2|<div class="(?:file|prev|next)/i)
  const bodyZone = cut > 0 ? zone.slice(0, cut) : zone
  const paras = paragraphs(bodyZone)
  const imgs = Array.from(page.matchAll(/data-url="(\/UP_FILES\/[^"]+\.(?:jpe?g|png))"/gi), (m) => m[1])
  const images = imgs.filter((u, n) => imgs.indexOf(u) === n).map((u) => ({ src: `${GNEWS}${u.split(';')[0].replace(/ /g, '%20')}` }))
  return paras.length ? build(paras, images, label) : null
}
