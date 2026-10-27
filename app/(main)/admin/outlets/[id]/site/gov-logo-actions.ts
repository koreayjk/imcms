'use server'

import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import type { T } from '@/lib/cms-i18n'

// 지자체 홈페이지에서 공식 로고 후보를 찾는다 (운영팀 전용). 서버가 시청 홈페이지를 열어 로고처럼 보이는 그림을 점수로 골라 보여 주고,
// 운영팀이 맞는 것을 클릭하면 그 그림이 로고 띠에 올라간다. 해외 접속을 막는 사이트는 못 열 수 있다 (그때는 로고 파일을 직접 올린다)
export type GovLogoCandidate = { src: string; dataUrl: string; type: string; bytes: number; why: string }
export type GovLogoResult = { error?: string; page?: string; candidates: GovLogoCandidate[] }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MAX_IMG = 1_200_000

function safeHost(u: URL) {
  const h = u.hostname.toLowerCase()
  if (!/^https?:$/.test(u.protocol)) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
  return h.endsWith('.kr') // 지자체·공공기관 주소만
}

function decode(buf: ArrayBuffer, contentType: string) {
  const head = new TextDecoder('latin1').decode(buf.slice(0, 4096))
  const cs = (/charset=([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8').toLowerCase()
  try { return new TextDecoder(/euc-?kr|ks_c|cp949|ms949/.test(cs) ? 'euc-kr' : cs).decode(buf) } catch { return new TextDecoder('utf-8').decode(buf) }
}

const GOOD = /logo|[-_/.]ci[-_/.0-9]|^ci[-_.]|[-_/]bi[-_/.0-9]|symbol|emblem|sym[-_]|심벌|엠블|로고|상징|시청|군청|구청|시청|home|main_?logo|top_?logo|h_?logo/i
const BAD = /banner|bnr|icon|btn|button|arrow|bullet|blank|spacer|pixel|sns|facebook|twitter|insta|youtube|kakao|naver|blog|popup|quick|sprite|search|login|ico_|_ico|bg[-_]|[-_]bg|line|dot|close|menu|slide|visual|photo|thumb|qr|app[-_]?store|play[-_]?store|footer|bottom|f_logo|foot/i

function candidates(html: string, base: string, t: T) {
  const body = html.slice(0, 120_000)
  const out: { url: string; score: number; why: string[] }[] = []
  const seen = new Set<string>()
  const push = (raw: string | undefined, score: number, why: string) => {
    if (!raw || raw.startsWith('data:')) return
    let abs: string
    try { abs = new URL(raw.trim(), base).toString() } catch { return }
    if (seen.has(abs)) return
    seen.add(abs); out.push({ url: abs, score, why: [why] })
  }
  let i = 0
  for (const m of body.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const attr = (n: string) => new RegExp(`\\b${n}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1] ?? ''
    const src = attr('data-src') || attr('src') || attr('data-original')
    if (!src) continue
    const alt = attr('alt'), cls = `${attr('class')} ${attr('id')}`
    let score = 0; const why: string[] = []
    if (GOOD.test(src)) { score += 5; why.push(t('파일 이름이 로고', 'File name looks like a logo')) }
    if (GOOD.test(alt)) { score += 4; why.push(t('설명이 로고', 'Description says logo')) }
    if (/logo|ci|gnb|header/i.test(cls)) { score += 3; why.push(t('로고 자리', 'In a logo position')) }
    if (i < 6) score += 3; else if (i < 16) score += 1
    if (BAD.test(src) || BAD.test(cls)) { score -= 6 }
    if (/\.(svg)(\?|$)/i.test(src)) score += 1
    push(src, score, why.join(' · ') || t(`위쪽 ${i + 1}번째 그림`, `Image #${i + 1} from the top`))
    i++
  }
  // 대표 그림·아이콘은 마지막 후보
  for (const m of body.matchAll(/<link\b[^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*>/gi)) push(/href=["']([^"']+)["']/i.exec(m[0])?.[1], -1, t('사이트 아이콘', 'Site icon'))
  push(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(body)?.[1], 0, t('공유 대표 그림', 'Share preview image'))
  return out.sort((a, b) => b.score - a.score).slice(0, 8)
}

async function grab(url: string, referer: string): Promise<{ type: string; buf: ArrayBuffer } | null> {
  try {
    const u = new URL(url)
    if (!safeHost(u)) return null
    const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer, Accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8' }, signal: AbortSignal.timeout(10_000), redirect: 'follow' })
    if (!res.ok) return null
    const type = (res.headers.get('content-type') ?? '').split(';')[0].toLowerCase()
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon)$/.test(type)) return null
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 500 || buf.byteLength > MAX_IMG) return null
    return { type, buf }
  } catch { return null }
}

export async function findGovLogos(pageUrl: string): Promise<GovLogoResult> {
  const { isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) return { error: t('운영팀만 쓸 수 있습니다.', 'Only the IM Newsroom team can use this.'), candidates: [] }
  let u: URL
  try { u = new URL(pageUrl) } catch { return { error: t('홈페이지 주소가 올바르지 않습니다.', 'The website address is not valid.'), candidates: [] } }
  if (!safeHost(u)) return { error: t('지자체 홈페이지(.kr) 주소만 열 수 있습니다.', 'Only local government website (.kr) addresses can be opened.'), candidates: [] }
  let res: Response
  try {
    res = await fetch(u.toString(), { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(12_000), redirect: 'follow' })
  } catch (e) {
    return { error: t(`홈페이지를 열지 못했습니다 (${e instanceof Error ? e.name : '연결 실패'}). 해외 접속을 막는 사이트일 수 있습니다. 로고 파일을 직접 올려 주세요.`, `Could not open the website (${e instanceof Error ? e.name : 'connection failed'}). The site may block overseas access. Please upload the logo file yourself.`), candidates: [] }
  }
  if (!res.ok) return { error: t(`홈페이지가 ${res.status} 응답을 줬습니다. 로고 파일을 직접 올려 주세요.`, `The website responded with ${res.status}. Please upload the logo file yourself.`), candidates: [] }
  const html = decode(await res.arrayBuffer(), res.headers.get('content-type') ?? '')
  const list = candidates(html, res.url || u.toString(), t)
  if (!list.length) return { error: t('로고처럼 보이는 그림을 못 찾았습니다. 로고 파일을 직접 올려 주세요.', 'Could not find any image that looks like a logo. Please upload the logo file yourself.'), page: res.url, candidates: [] }
  const got = await Promise.all(list.map(async (c) => {
    const g = await grab(c.url, res.url || u.toString())
    if (!g) return null
    const b64 = Buffer.from(g.buf).toString('base64')
    return { src: c.url, dataUrl: `data:${g.type};base64,${b64}`, type: g.type, bytes: g.buf.byteLength, why: c.why.join(' · ') } satisfies GovLogoCandidate
  }))
  const seenSize = new Set<string>()
  const cands = got.filter((x): x is GovLogoCandidate => !!x).filter((x) => { const k = `${x.type}${x.bytes}`; if (seenSize.has(k)) return false; seenSize.add(k); return true }).slice(0, 6)
  return cands.length ? { page: res.url, candidates: cands } : { error: t('후보 그림을 내려받지 못했습니다. 로고 파일을 직접 올려 주세요.', 'Could not download the candidate images. Please upload the logo file yourself.'), page: res.url, candidates: [] }
}
