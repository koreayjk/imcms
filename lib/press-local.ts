// 지자체 보도자료 수집 (안산시 홈페이지, 경기도뉴스포털의 경기도·시군 보도자료)
//   RSS가 없거나 인증키가 필요한 곳이라 게시판 목록 페이지를 읽는다. 목록은 제목·담당부서·날짜·상세 주소를, 상세는 본문 문단과 사진을 돌려준다.
//   서버(수집 크론·보도자료 열기)에서만 쓴다. 요청은 매시간 몇 번뿐이고, 로그인·차단 우회는 하지 않는다 (막히면 그 출처는 건너뛴다)
import type { PressRow } from './press'

export type LocalKind = 'ansan' | 'gnews' | 'pyeongtaek' | 'ntt' | 'board' | 'incheon' | 'seoul' | 'jeju' | 'gyeongbuk'

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

// ───────── 평택시 홈페이지 (보도자료 bcIdx=90) ─────────
//   목록은 그대로 읽히지만 상세 열기는 폼 전송(POST)이라 본문·사진은 가져오지 못한다. 목록의 제목·날짜·요약까지만 보도자료함에 쌓는다
const PYEONGTAEK = 'https://www.pyeongtaek.go.kr'
export const PYEONGTAEK_LIST = `${PYEONGTAEK}/pyeongtaek/board/post/list.do?bcIdx=90&mid=0402010000`

export function parsePyeongtaekList(page: string): PressRow[] {
  const rows: PressRow[] = []
  for (const li of page.matchAll(/<li[^>]*>\s*<a[^>]+data-req-get-p-idx="(\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)) {
    const id = li[1]
    const b = li[2]
    const title = text(/<span class="list_title">([\s\S]*?)<\/span>/i.exec(b)?.[1] ?? '')
    if (!title) continue
    const date = kstDate(/<span class="list_data">[\s\S]*?(\d{4}[-.]\d{2}[-.]\d{2})/i.exec(b)?.[1] ?? '')
    // 요약 앞의 "2026. 11. 3. 부서 031-… 담당자 031-…" 같은 머리말은 뺀다
    let summary = text(/<span class="list_txt">([\s\S]*?)<\/span>/i.exec(b)?.[1] ?? '')
    const at = summary.indexOf(title.slice(0, 6))
    if (at > 0) summary = summary.slice(at)
    rows.push({ source_key: 'lg-pyeongtaek', source_name: '평택시 보도자료', guid: `lg-pyeongtaek:${id}`, title, link: PYEONGTAEK_LIST, summary: summary.slice(0, 400) || null, body_html: null, published_at: date })
  }
  return rows
}

// ───────── 표준 게시판형 (selectBbsNttList.do) — 충북·서산·영월·동두천·양평·은평·영등포 등 ─────────
//   목록 주소만 다르고 목록 모양(./selectBbsNttView.do?key=…&bbsNo=…&nttNo=…)이 같다. 상세의 본문 칸 이름만 사이트마다 달라 여러 이름을 차례로 찾는다
export function parseNttList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const rows: PressRow[] = []
  for (const tr of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1]
    const a = /<a[^>]+href="([^"]*selectBbsNttView\.do[^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(b)
    if (!a) continue
    const href = decode(a[1])
    const ntt = /nttNo=(\d+)/.exec(href)?.[1]
    const bbs = /bbsNo=(\d+)/.exec(href)?.[1]
    const k = /[?&]key=(\d+)/.exec(href)?.[1]
    const title = text(a[2])
    if (!ntt || !bbs || !k || !title) continue
    const date = kstDate(/<time[^>]*datetime="([^"]+)"/i.exec(b)?.[1] ?? /(\d{4}[-.]\d{2}[-.]\d{2})/.exec(text(b))?.[1] ?? '')
    const link = new URL(`./selectBbsNttView.do?key=${k}&bbsNo=${bbs}&nttNo=${ntt}`, listUrl).toString()
    rows.push({ source_key: key, source_name: label, guid: `${key}:${bbs}:${ntt}`, title, link, summary: null, body_html: null, published_at: date })
  }
  return rows
}

export function parseNttDetail(page: string, base: string, label: string) {
  const m = /<(div|td)[^>]*class="[^"]*\b(?:contenttext|bbs_content|p-table__content|viewcontent|view_content|nttCn)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(page)
  if (!m) return null
  const inner = m[2]
  const imgs = Array.from(inner.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/gi), (x) => { try { return new URL(decode(x[1]), base).toString() } catch { return '' } })
    .filter((u) => /^https?:\/\//.test(u) && !/ico|btn|icon|blank/i.test(u))
  const uniq = imgs.filter((u, n) => imgs.indexOf(u) === n).map((src) => ({ src }))
  const paras = paragraphs(inner.replace(/&nbsp;/gi, ' '))
  return paras.length ? build(paras, uniq, label) : null
}

// ───────── 사이트마다 모양이 다른 게시판 (서울 중랑구·마포구 등) ─────────
//   표(<tr>) 목록에서 글 주소 규칙(href)에 맞는 링크를 제목으로 읽고, 상세는 본문 칸(body)만 읽는다. 사이트별 규칙은 아래 BOARDS 에 둔다
type BoardCfg = { id: RegExp; link: (id: string, origin: string) => string; body: RegExp }
export const BOARDS: Record<string, BoardCfg> = {
  'lg-jungnang': {
    id: /\/portal\/bbs\/view\/B0000151\/(\d+)\.do/,
    link: (id, o) => `${o}/portal/bbs/view/B0000151/${id}.do?menuNo=200474`,
    body: /<div[^>]*id="dbdata"[^>]*>([\s\S]*?)<\/div>/i,
  },
  'lg-chungnam': {
    id: /cnapcPress\/view\.do\?nttId=(\d+)/,
    link: (id, o) => `${o}/cnportal/cnapcPressList/cnapcPress/view.do?nttId=${id}&menuNo=500498`,
    body: /<div class="board-view-inner">\s*<div class="content">([\s\S]*?)<\/div>/i,
  },
  'lg-seoul': {
    id: /nttNo=(\d+)/,
    link: (id, o) => `${o}/news/news_report.do?bbsNo=158&nttNo=${id}`,
    body: /<div id="scrabArea"[^>]*>([\s\S]*?)<\/div>/i,
  },
  'lg-incheon': {
    id: /\/IC010205\/view\?repSeq=([A-Z0-9_]+)/,
    link: (id, o) => `${o}/IC010205/view?repSeq=${id}`,
    body: /<div[^>]*class="[^"]*board-view-contents[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  },
  'lg-daejeon': {
    id: /boardNormalView\.do\?[^"]*ntatcSeq=(\d+)/,
    link: (id, o) => `${o}/drh/board/boardNormalView.do?boardId=normal_0189&menuSeq=1632&ntatcSeq=${id}`,
    body: /<div class="board_txt">([\s\S]*?)(?=<\/div>\s*<\/div>\s*<div class="kogl_type")/i,
  },
  'lg-ulsan-donggu': {
    id: /selectBoardArticle\.do\?bbsId=BBSMSTR_000000000322&nttId=(\d+)/,
    link: (id, o) => `${o}/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000322&nttId=${id}`,
    body: /<div class="bbs_detail_content">([\s\S]*?)(?:<!--\[data-hwpjson\]|<\/div>)/i,
  },
  'lg-jeju': {
    id: /act=view&seq=(\d+)/,
    link: (id, o) => `${o}/news/bodo/list.htm?act=view&seq=${id}`,
    body: /<div id="articleContents"[^>]*>([\s\S]*?)<\/div>\s*<div class="news-info">/i,
  },
  'lg-mapo': {
    id: /\/site\/main\/board\/press\/(\d+)/,
    link: (id, o) => `${o}/site/main/board/press/${id}`,
    body: /<div[^>]*class="[^"]*bbs_view_body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  },
}

// 서울특별시 (목록 표, 글 열기는 fnTbbsView(글번호) → ?bbsNo=158&nttNo=글번호). 본문은 한글(HWP) 문서 보기 틀이라 HTML에는 첫머리 요약(제목+핵심 줄)만 있다
export function parseSeoulList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const base = new URL(listUrl)
  const bbsNo = /const bbsNo = "(\d+)"/.exec(page)?.[1] ?? '158'
  const rows: PressRow[] = []
  for (const tr of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1]
    const a = /fnTbbsView\('(\d+)'\)[^>]*>([\s\S]*?)<\/a>/i.exec(b)
    if (!a) continue
    const title = text(a[2])
    if (!title || /사후동정|동정\)/.test(title)) continue
    const dept = text(/<td class="sib-lst-type-basic-tablet-hidden">(?:(?!<\/td>)[\s\S])*?<\/td>\s*<td[^>]*>\s*\d{4}/i.exec(b)?.[0]?.replace(/\d{4}[\s\S]*$/, '') ?? '')
    const date = kstDate(/(\d{4}-\d{2}-\d{2})/.exec(text(b))?.[1] ?? '')
    rows.push({ source_key: key, source_name: label, guid: `${key}:${a[1]}`, title, link: `${base.origin}${base.pathname}?bbsNo=${bbsNo}&nttNo=${a[1]}`, summary: null, body_html: null, published_at: date })
    void dept
  }
  return rows
}

// 인천광역시 (목록이 <li> 카드형: 제목 strong.subject, 제공일자 dd)
export function parseIncheonList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const origin = new URL(listUrl).origin
  const rows: PressRow[] = []
  for (const li of page.matchAll(/<li>\s*<a[^>]+href="(\/IC010205\/view\?repSeq=([A-Z0-9_]+)[^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)) {
    const id = li[2]
    const b = li[3]
    const title = text(/<strong class="subject">([\s\S]*?)<\/strong>/i.exec(b)?.[1] ?? '')
    if (!title) continue
    const summary = text(/<div class="txt">([\s\S]*?)<\/div>/i.exec(b)?.[1] ?? '').slice(0, 300) || null
    const date = kstDate(/제공일자<\/dt>\s*<dd>([^<]*)</i.exec(b)?.[1] ?? '')
    rows.push({ source_key: key, source_name: label, guid: `${key}:${id}`, title, link: `${origin}/IC010205/view?repSeq=${id}`, summary, body_html: null, published_at: date })
  }
  return rows
}

// 제주특별자치도 (목록이 <li class="board-news__article"> 카드형: 제목 strong, 날짜 "부서 | YYYY-MM-DD")
export function parseJejuList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const origin = new URL(listUrl).origin
  const rows: PressRow[] = []
  for (const li of page.matchAll(/<li[^>]*board-news__article[^>]*>([\s\S]*?)<\/li>/gi)) {
    const b = li[1]
    const id = /act=view(?:&amp;|&)seq=(\d+)/.exec(b)?.[1]
    const title = text(/<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(b)?.[1] ?? '').replace(/^<브리핑[^>]*>\s*/, '')
    if (!id || !title) continue
    rows.push({ source_key: key, source_name: label, guid: `${key}:${id}`, title, link: `${origin}/news/bodo/list.htm?act=view&seq=${id}`, summary: null, body_html: null, published_at: kstDate(text(b)) })
  }
  return rows
}

// 경상북도 (상세가 폼 전송(POST)이라 열 수 없지만, 목록 카드에 본문 전체가 들어 있다)
export function parseGyeongbukList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const rows: PressRow[] = []
  for (const li of page.matchAll(/<li>\s*<a[^>]*boardList\.view\('(\d+)'\)[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)) {
    const b = li[2]
    const title = text(/<p class="txt-xlarge">([\s\S]*?)<\/p>/i.exec(b)?.[1] ?? '')
    const body = text(/<div class="cont">([\s\S]*?)<\/div>/i.exec(b)?.[1] ?? '')
    if (!title) continue
    const sentences = body.split(/(?<=[다요])\.\s+/).map((s) => s.trim()).filter(Boolean)
    const paras: string[] = []
    for (let i = 0; i < sentences.length; i += 3) paras.push(sentences.slice(i, i + 3).join('. ').replace(/\.?$/, '.'))
    const img = /<img[^>]+src="([^"]+)"/i.exec(b)?.[1]
    const pic = img && !/ico|btn|blank|noimg/i.test(img) ? (() => { try { return new URL(decode(img), listUrl).toString() } catch { return '' } })() : ''
    const built = paras.length ? build(paras, pic ? [{ src: pic }] : [], label) : null
    rows.push({
      source_key: key, source_name: label, guid: `${key}:${li[1]}`, title, link: listUrl,
      summary: body.slice(0, 300) || null, body_html: built?.html ?? null,
      published_at: kstDate(text(/<div class="classify">([\s\S]*?)<\/div>/i.exec(b)?.[1] ?? '')),
    })
  }
  return rows
}

export function parseBoardList(page: string, key: string, label: string, listUrl: string): PressRow[] {
  const cfg = BOARDS[key]
  if (!cfg) return []
  const origin = new URL(listUrl).origin
  const rows: PressRow[] = []
  for (const tr of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const b = tr[1]
    const a = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
    let hit: { id: string; title: string } | null = null
    for (const m of b.matchAll(a)) {
      const id = cfg.id.exec(decode(m[1]))?.[1]
      const t = text(m[2])
      if (id && t && !/^\d+$/.test(t)) { hit = { id, title: t }; break }
    }
    if (!hit) continue
    const date = kstDate(/(\d{4}[-.]\d{2}[-.]\d{2})/.exec(text(b))?.[1] ?? '')
    rows.push({ source_key: key, source_name: label, guid: `${key}:${hit.id}`, title: hit.title, link: cfg.link(hit.id, origin), summary: null, body_html: null, published_at: date })
  }
  return rows
}

export function parseBoardDetail(page: string, key: string, origin: string, label: string) {
  const cfg = BOARDS[key]
  const inner = cfg ? cfg.body.exec(page)?.[1] : null
  if (!inner) return null
  const imgs = Array.from(inner.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi), (x) => { try { return new URL(decode(x[1]), origin).toString() } catch { return '' } })
    .filter((u) => /^https?:\/\//.test(u) && !/ico|btn|icon|blank/i.test(u))
  const uniq = imgs.filter((u, n) => imgs.indexOf(u) === n).map((src) => ({ src }))
  const paras = paragraphs(inner.replace(/&nbsp;/gi, ' '))
  return paras.length ? build(paras, uniq, label) : null
}
