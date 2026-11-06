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
  const m = /(\d{4})[-./](\d{2})[-./](\d{2})/.exec(s)
  return m ? new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+09:00`).toISOString() : null
}

// 본문 HTML → 문단 (<p>·줄바꿈 단위). 글꼴·색 같은 꾸밈은 모두 버린다
function paragraphs(inner: string): string[] {
  const cleaned = inner.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '').replace(/<img[^>]*>/gi, '').replace(/<p\b[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
  const parts = /<p[\s>]/i.test(cleaned)
    ? Array.from(cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi), (m) => m[1]).flatMap((x) => x.split(/(?:<br\s*\/?>\s*){2,}/i))
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
  const imgs = Array.from(page.matchAll(/data-url="(\/(?:UP_FILES|OP_UPDATA)\/[^"]+\.(?:jpe?g|png))"/gi), (m) => m[1])
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
  if (rows.length) return rows
  // 표가 아니라 사진 카드(<li class="p-media">·post_title)로 된 목록: 이 게시판(bbsNo)의 글 링크만 읽는다
  const listBbs = /[?&]bbsNo=(\d+)/.exec(listUrl)?.[1]
  const seen = new Set<string>()
  const anchors = Array.from(page.matchAll(/<a\b[^>]*href="([^"]*selectBbsNttView\.do[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi))
  for (const m of anchors) {
    const href = decode(m[1])
    const ntt = /nttNo=(\d+)/.exec(href)?.[1]
    const bbs = /bbsNo=(\d+)/.exec(href)?.[1]
    const k = /[?&]key=(\d+)/.exec(href)?.[1]
    if (!ntt || !bbs || !k || seen.has(ntt) || (listBbs && bbs !== listBbs) || /fact_text/.test(m[0].slice(0, 200))) continue
    const inner = m[2]
    const alt = /<img[^>]+alt="([^"]*)"/i.exec(inner)?.[1]?.replace(/\s*이미지\s*$/, '')
    const title = text(/<span[^>]+class="[^"]*(?:post_title|p-media__title|title)[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(inner)?.[1] ?? '') || text(/<(?:strong|h\d)[^>]*>([\s\S]*?)<\/(?:strong|h\d)>/i.exec(inner)?.[1] ?? '') || text(alt ?? '') || text(inner)
    if (!title || title.length < 4) continue
    seen.add(ntt)
    const tail = page.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 600)
    const date = kstDate(/(\d{4}[-./]\d{2}[-./]\d{2})/.exec(text(inner))?.[1] ?? /(\d{4}[-./]\d{2}[-./]\d{2})/.exec(text(tail))?.[1] ?? '')
    rows.push({ source_key: key, source_name: label, guid: `${key}:${bbs}:${ntt}`, title, link: new URL(`./selectBbsNttView.do?key=${k}&bbsNo=${bbs}&nttNo=${ntt}`, listUrl).toString(), summary: null, body_html: null, published_at: date })
  }
  return rows
}

export function parseNttDetail(page: string, base: string, label: string) {
  // 본문 칸이 div·td 가 아니라 표의 한 줄(<tr class="p-table__content">, 김포시)인 사이트도 있다
  const m = /<(div|td|tr)[^>]*class="[^"]*\b(?:contenttext|bbs_content|p-table__content|viewcontent|view_content|nttCn)\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(page)
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
type BoardCfg = { id: RegExp; link: (id: string, origin: string) => string; body: RegExp; image?: RegExp }  // image: 본문 칸 밖에 있는 대표 사진의 주소(첫 번째 묶음)
export const BOARDS: Record<string, BoardCfg> = {
  // 청양군: 목록은 카드형(제목은 strong.subject), 상세는 사진 칸과 본문 칸이 따로다 (사진 주소의 ;jsessionid=… 는 뺀다)
  'lg-cheongyang': {
    id: /BBSMSTR_000000000064\/selectBoardArticle\.do[^"]*?nttId=(\d+)/,
    link: (id, o) => `${o}/cop/bbs/BBSMSTR_000000000064/selectBoardArticle.do?nttId=${id}`,
    body: /<\/script>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td colspan="6">([\s\S]*?)<\/td>/i,
    image: /<img[^>]+src='([^']*getImage\.do[^']*)'/i,
  },
  // 고양시: 목록 제목 링크는 onclick=fnView('1090','ID',…) 형이고, 상세는 webView(PC용) 칸 (바로 뒤에 mobileView 칸이 이어진다)
  'lg-goyang': {
    id: /fnView\('1090',\s*'(\d+)'/,
    link: (id, o) => `${o}/news/user/bbs/BD_selectBbs.do?q_bbsCode=1090&q_bbscttSn=${id}`,
    body: /<div id="webView"[^>]*>([\s\S]*?)<\/div>\s*<div id="mobileView"/i,
  },
  // 청주시: 시정소식 > 새소식 (bbsNo=40). 상세 본문은 board_text_td 칸
  'lg-cheongju': {
    id: /selectBbsNttView\.do\?[^"]*nttNo=(\d+)/,
    link: (id, o) => `${o}/www/selectBbsNttView.do?key=23485&bbsNo=40&nttNo=${id}`,
    body: /<td class="board_text_td">([\s\S]*?)<\/td>/i,
  },
  // 보령시: 보도자료 목록 view.do?mgtno=ID, 상세 본문은 word-break 칸
  'lg-boryeong': {
    id: /view\.do\?mgtno=(\d+)/,
    link: (id, o) => `${o}/prog/eminwon/kor/AA/sub04_02/view.do?mgtno=${id}`,
    body: /<td style="word-break:break-all;"[^>]*>([\s\S]*?)<\/td>/i,
  },
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
    body: /<div class="board_txt">([\s\S]*?)(?=<\/div>\s*<\/div>\s*(?:<!--[\s\S]*?-->\s*)?<div class="kogl_type")/i,
  },
  'lg-ulsan-donggu': {
    id: /selectBoardArticle\.do\?bbsId=BBSMSTR_000000000322&nttId=(\d+)/,
    link: (id, o) => `${o}/cop/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000000322&nttId=${id}`,
    body: /<div class="bbs_detail_content">([\s\S]*?)(?:<!--\[data-hwpjson\]|<\/div>)/i,
  },
  'lg-uiwang': {
    id: /\/UWKORINFO0201\/(\d+)\//,
    link: (id, o) => `${o}/UWKORINFO0201/${id}/`,
    body: /<div class="txtWrap">([\s\S]*?)<div class="bbs-nav">/i,
  },
  'lg-muan': {
    id: /report\?idx=(\d+)&mode=view/,
    link: (id, o) => `${o}/www/openmuan/new/report/report?idx=${id}&mode=view`,
    body: /<div class="board_cont">([\s\S]*?)(?=<\/div>\s*<\/div>\s*<!-- 버튼)/i,
  },
  'lg-dangjin': {
    id: /BBSMSTR_000000000014\/selectBoardArticle\.do\?nttId=(\d+)/,
    link: (id, o) => `${o}/cop/bbs/BBSMSTR_000000000014/selectBoardArticle.do?nttId=${id}`,
    body: /<div class="bbs_detail_cont">([\s\S]*?)<\/div>/i,
  },
  'lg-namdong': {
    id: /bbsMsgDetail\.do\?msg_seq=(\d+)&bcd=press_release/,
    link: (id, o) => `${o}/main/bbs/bbsMsgDetail.do?msg_seq=${id}&bcd=press_release`,
    body: /<div class="detail">([\s\S]*?)<\/div>/i,
  },
  'lg-bupyeong': {
    id: /bbsMsgDetail\.do\?msg_seq=(\d+)&bcd=report/,
    link: (id, o) => `${o}/bbs/bbsMsgDetail.do?msg_seq=${id}&bcd=report`,
    body: /<div class="detail">([\s\S]*?)<\/div>/i,
  },
  'lg-michuhol': {
    id: /view\.do\?sq=(\d+)&board_code=news_item/,
    link: (id, o) => `${o}/main/board/view.do?sq=${id}&board_code=news_item`,
    body: /<div class="content editor_content">\s*(?:<div class="content editor_content">)?([\s\S]*?)<\/div>/i,   // 사이트가 한 겹으로 바꾼 뒤에도 읽도록 두 겹은 있어도 없어도 된다
  },
  'lg-gwangjin': {
    id: /B0000002\/view\.do\?nttId=(\d+)/,
    link: (id, o) => `${o}/portal/bbs/B0000002/view.do?nttId=${id}&menuNo=200191`,
    body: /<div id="dbData"[^>]*>([\s\S]*?)<\/div>/i,
  },
  'lg-gangseo': {
    id: /\/gs040201\/(\d+)/,
    link: (id, o) => `${o}/gs040201/${id}`,
    body: /<div class="view-content"[^>]*>([\s\S]*?)<div class="board-page-wrap">/i,
  },
  'lg-dongjak': {
    id: /B0000171\/view\.do\?nttId=(\d+)/,
    link: (id, o) => `${o}/portal/bbs/B0000171/view.do?nttId=${id}&menuNo=200647`,
    body: /<div class="dbData">([\s\S]*?)<\/div>/i,
  },
  'lg-mokpo': {
    id: /report_material\?idx=(\d+)&mode=view/,
    link: (id, o) => `${o}/www/mokpo_news/press_release/report_material?idx=${id}&mode=view`,
    body: /<div class="text_viewbox">([\s\S]*?)<\/div>/i,
  },
  'lg-naju': {
    id: /coverage\?idx=(\d+)&mode=view/,
    link: (id, o) => `${o}/www/administration/reporting/coverage?idx=${id}&mode=view`,
    body: /<div class='view_box' id='con_ko'>([\s\S]*?)<\/div>/i,
  },
  'lg-chuncheon': {
    id: /press-release\/\?bbsId=BBSMSTR_000000000335&nttId=(\d+)/,
    link: (id, o) => `${o}/mayor/newsroom/press-release/?bbsId=BBSMSTR_000000000335&nttId=${id}&flag=view`,
    body: /<div class="board-view-con">([\s\S]*?)<div class="contents-bottom/i,
  },
  'lg-gwangsan': {
    id: /boardView\.do\?pageId=www16&boardId=REPORT_NEW&seq=(\d+)/,
    link: (id, o) => `${o}/boardView.do?pageId=www16&boardId=REPORT_NEW&seq=${id}&movePage=1`,
    body: /<div class="boardContents[^"]*">([\s\S]*?)<\/div>/i,
  },
  'lg-nowon': {
    id: /opView\('(\d+)'\)/,
    link: (id, o) => `${o}/www/user/bbs/BD_selectBbs.do?q_bbsCode=1027&q_bbscttSn=${id}`,
    body: /<div class="article-body">([\s\S]*?)<div class="article-view-btn">/i,
  },
  'lg-paju': {
    id: /jsView\('1023',\s*'(\d+)'/,
    link: (id, o) => `${o}/user/board/BD_board.view.do?seq=${id}&bbsCd=1023`,
    body: /<div class="article-body">([\s\S]*?)(?=<div id="content-info"|<div class="article-view-btn">)/i,
  },
  'lg-jongno': {
    id: /viewMove\('(\d+)'\)/,
    link: (id, o) => `${o}/portal/bbs/selectBoardArticle.do?bbsId=BBSMSTR_000000001618&menuNo=388338&menuId=388338&nttId=${id}`,
    body: /<td[^>]*>((?:(?!<td)[\s\S])*?)<div data-hjsonver=/i,
  },
  'lg-yeongdo': {
    id: /idx=(\d+)&amode=view/,
    link: (id, o) => `${o}/00000/00007/00011.web?gcode=1027&idx=${id}&amode=view&`,
    body: /<div class="substanceautolink">([\s\S]*?)<\/div>/i,
  },
  'lg-jinju': {
    id: /idx=(\d+)&amode=view/,
    link: (id, o) => `${o}/00138.web?gcode=1004&idx=${id}&amode=view&`,
    body: /<div class="substanceautolink">([\s\S]*?)<\/div>/i,
  },
  'lg-seongnam': {
    id: /fn_move_form\('(\d+)'\)/,
    link: (id, o) => `${o}/bbs010501/${id}`,
    body: /<div class="board-view-content">([\s\S]*?)<\/div>/i,
  },
  'lg-yangcheon': {
    id: /doBbsFView\('290','(\d+)'/,
    link: (id, o) => `${o}/site/yangcheon/ex/bbs/View.do?cbIdx=290&bcIdx=${id}`,
    // 본문이 따로 없고 공유용 메타(og:description)에 전문이 들어 있다 (문단 구분은 &amp;nbsp;)
    body: /<meta id="mtTitle"[^>]*>\s*<meta property="og:description" content="([^"]*)"/i,
  },
  'lg-ulju': {
    id: /goTo\.view\('list','(\d+)'/,
    link: (id, o) => `${o}/ulju/bbs/view.do?ptIdx=146&mId=0404020000&bIdx=${id}`,
    body: /<div class="view_cont[^"]*">\s*<div class="mT10">([\s\S]*?)<\/div>/i,
  },
  'lg-gimhae': {
    id: /idx=(\d+)&amode=view/,
    link: (id, o) => `${o}/03360/00023/00025.web?gcode=1172&idx=${id}&amode=view&`,
    body: /(?:<div class="substanceautolink">|\*\]\]>\*\/<\/script>)([\s\S]*?)<\/div>/i,
  },
  'lg-seocho': {
    id: /View\.do\?cbIdx=61&bcIdx=(\d+)/,
    link: (id, o) => `${o}/site/seocho/ex/bbs/View.do?cbIdx=61&bcIdx=${id}`,
    body: /<div class="view_contents">([\s\S]*?)<\/div>/i,
  },
  'lg-gangnam': {
    id: /\/B_000031\/(\d+)\/view\.do/,
    link: (id, o) => `${o}/board/B_000031/${id}/view.do?mid=ID01_0313`,
    body: /<div class="post-content">([\s\S]*?)<\/div>/i,
  },
  'lg-gangdong': {
    id: /\/web\/newportal\/press\/(\d+)/,
    link: (id, o) => `${o}/web/newportal/press/${id}`,
    body: /<td colspan="4" style="border-left:0px">([\s\S]*?)<\/td>/i,
  },
  'lg-seo-incheon': {
    id: /bbsMsgDetail\.do\?msg_seq=(\d+)&bcd=report/,
    link: (id, o) => `${o}/open_content/main/bbs/bbsMsgDetail.do?msg_seq=${id}&bcd=report`,
    body: /<div class="con">([\s\S]*?)<\/div>/i,
  },
  'lg-ganghwa': {
    id: /bbsMsgDetail\.do\?msg_seq=(\d+)&bcd=report/,
    link: (id, o) => `${o}/open_content/main/bbs/bbsMsgDetail.do?msg_seq=${id}&bcd=report`,
    body: /<div class="con">([\s\S]*?)<\/div>/i,
  },
  'lg-yeonsu': {
    id: /report\.asp\?page=v&gotopage=\d+&seq=(\d+)/,
    link: (id, o) => `${o}/main/community/notify/report.asp?page=v&gotopage=1&seq=${id}`,
    body: /<div class="con">([\s\S]*?)<\/div>/i,
  },
  'lg-suwon': {
    id: /jsView\('1043',\s*'(\d+)'/,
    link: (id, o) => `${o}/web/board/BD_board.view.do?seq=${id}&bbsCd=1043`,
    body: /<td[^>]*class="p-table__content[^"]*"[^>]*>([\s\S]*?)<\/td>/i,
  },
  'lg-gwangmyeong': {
    id: /opView\('(\d+)'\)/,
    link: (id, o) => `${o}/pt/user/bbs/BD_selectBbs.do?q_bbsCode=2606&q_bbscttSn=${id}`,
    body: /<div class="nvcon-box">([\s\S]*?)<\/div>/i,
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

function boardTitle(anchor: string, inner: string): string {
  // 카드 목록: 링크 안에 제목(.subject)과 요약이 함께 있으면 제목만
  const subj = /<(strong|span|p|em|b)[^>]*class="[^"]*\bsubject\b[^"]*"[^>]*>([\s\S]*?)<\/\1>/i.exec(inner)
  let t = text(subj ? subj[2] : inner)
  const w = /wdigm_title\('([\s\S]*?)'\)\s*\)/.exec(inner)
  if (w) t = text(w[1])
  if (/(\.{2,3}|…)$/.test(t)) {
    const full = /\btitle="([^"]+)"/.exec(anchor)?.[1]
    if (full && !/번글$/.test(full)) t = decode(full).trim()
  }
  return t.replace(/\s*첨부파일$/, '').replace(/\s+N$/, '')
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
      const id = cfg.id.exec(decode(m[0]))?.[1]
      const t = boardTitle(m[0], m[2])
      if (id && t && !/^\d+$/.test(t)) { hit = { id, title: t }; break }
    }
    if (!hit) continue
    const date = kstDate(/(\d{4}[-./]\d{2}[-./]\d{2})/.exec(text(b))?.[1] ?? '')
    rows.push({ source_key: key, source_name: label, guid: `${key}:${hit.id}`, title: hit.title, link: cfg.link(hit.id, origin), summary: null, body_html: null, published_at: date })
  }
  if (rows.length) return rows
  // 표가 아니라 <li>·카드 목록인 사이트: 글 주소 규칙에 맞는 링크를 모두 찾고, 날짜는 그 링크 뒤쪽에서 읽는다
  const found = new Map<string, { title: string; date: string | null }>()
  const anchors = Array.from(page.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi))
  anchors.forEach((m, i) => {
    const id = cfg.id.exec(decode(m[0]))?.[1]
    const t = boardTitle(m[0], m[2])
    if (!id || !t || /^\d+$/.test(t) || t.length < 4) return
    const end = (m.index ?? 0) + m[0].length
    const next = anchors.slice(i + 1).find((x) => cfg.id.test(decode(x[0])) && text(x[2]).length >= 4)
    const tail = page.slice(end, Math.min(next?.index ?? end + 3000, end + 3000))
    // 날짜가 링크 안(카드의 작성일 칸)에 있는 사이트도 있어, 링크 안 → 링크 뒤 순서로 찾는다
    const date = kstDate(/(\d{4}[-./]\d{2}[-./]\d{2})/.exec(text(m[0]) + ' ' + text(tail))?.[1] ?? '')
    const prev = found.get(id)
    if (!prev || t.length > prev.title.length) found.set(id, { title: t, date: date ?? prev?.date ?? null })
  })
  for (const [id, v] of found) {
    rows.push({ source_key: key, source_name: label, guid: `${key}:${id}`, title: v.title, link: cfg.link(id, origin), summary: null, body_html: null, published_at: v.date })
  }
  return rows
}

export function parseBoardDetail(page: string, key: string, origin: string, label: string) {
  const cfg = BOARDS[key]
  const inner = cfg ? cfg.body.exec(page)?.[1] : null
  if (!inner) return null
  // onError="this.src='…no_image.png'" 같은 속성 안의 src 를 사진 주소로 잘못 읽지 않게 이벤트 속성은 빼고 읽는다
  const noEvents = inner.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '')
  const imgs = Array.from(noEvents.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi), (x) => { try { return new URL(decode(x[1]), origin).toString() } catch { return '' } })
    .filter((u) => /^https?:\/\//.test(u) && !/ico|btn|icon|blank/i.test(u))
  const extra = cfg?.image?.exec(page)?.[1]
  if (extra) { try { imgs.unshift(new URL(decode(extra).replace(/;jsessionid=[^?"']*/i, ''), origin).toString()) } catch { /* 주소를 못 읽으면 건너뜀 */ } }
  const uniq = imgs.filter((u, n) => imgs.indexOf(u) === n).map((src) => ({ src }))
  const paras = paragraphs(inner.replace(/&amp;nbsp;/gi, '<br><br>').replace(/&amp;(lsquo|rsquo|ldquo|rdquo|middot|hellip|quot|#39);/gi, '&$1;').replace(/&nbsp;/gi, ' '))
  return paras.length ? build(paras, uniq, label) : null
}
