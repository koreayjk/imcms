import { escapeHtml, htmlToText, textToParagraphs } from './press'

// 받은 메일 한 통 (Postmark 인바운드 형식. Resend로 받은 메일도 이 형식으로 바꿔서 쓴다 — resend-inbound.ts)
export type InboundMail = {
  From?: string
  FromName?: string
  FromFull?: { Email?: string; Name?: string }
  To?: string
  OriginalRecipient?: string
  MailboxHash?: string
  Subject?: string
  MessageID?: string
  Date?: string
  TextBody?: string
  HtmlBody?: string
  Headers?: { Name: string; Value: string }[]
  Attachments?: { Name?: string; Content?: string; ContentType?: string; ContentLength?: number }[]
  // 첨부를 가져오는 중 있었던 일 (원인 확인용, 비밀 값 없음)
  AttachNotes?: string[]
}

export type BundleItem = { n: number; title: string; summary: string; bodyHtml: string; guid: string }

export type ParsedMail =
  | { kind: 'verify'; token: string; code: string | null; link: string | null }
  | {
      kind: 'release'
      token: string
      sourceName: string
      guid: string
      title: string
      summary: string
      bodyHtml: string
      publishedAt: string | null
      attachments: { name: string; content_type: string; size: number; content: string }[]
      skipped: string[]
      // "취재지원자료 총N건"처럼 한 통에 보도자료가 여러 건 묶여 온 메일이면 한 건씩 나눈 것 (2건 이상일 때만)
      items?: BundleItem[]
    }

// 첨부는 사진·문서만, 한 통에 합계 3MB까지 (서버가 받을 수 있는 요청 크기 한도 때문)
// 첨부 합계 한도: 보도자료 사진은 한 장에 2~5MB인 경우가 많아 넉넉하게 (사진을 먼저 담는다)
export const MAX_ATTACH_TOTAL = 15 * 1024 * 1024
const MAX_TOTAL = MAX_ATTACH_TOTAL
// 사진 판단: 메일 프로그램마다 image/jpg, application/octet-stream 등으로 보내므로 확장자도 본다
export const isImageAttachment = (type: string, name: string) => /^image\/(p?jpe?g|png|x-png|webp|gif)$/i.test(type) || /\.(jpe?g|png|webp|gif)$/i.test(name)
const KEEP_TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/(x-)?hwp|application\/haansofthwp|application\/vnd\.hancom\.hwpx|application\/octet-stream|text\/(plain|markdown|x-markdown|csv))$/i
const KEEP_EXT = /\.(jpe?g|png|webp|gif|pdf|hwp|hwpx|docx?|txt|md|markdown|csv)$/i

// 받는 주소 abc+토큰@도메인 에서 토큰을 꺼낸다
export function tokenOf(mail: InboundMail) {
  if (mail.MailboxHash) return mail.MailboxHash.trim().toLowerCase()
  const addr = [mail.OriginalRecipient, mail.To].filter(Boolean).join(',')
  const m = addr.match(/[A-Za-z0-9._%-]+\+([A-Za-z0-9]+)@/)
  return m ? m[1].toLowerCase() : ''
}

// Gmail 전달 주소 확인 메일
function verification(mail: InboundMail) {
  const from = (mail.FromFull?.Email ?? mail.From ?? '').toLowerCase()
  if (!from.includes('forwarding-noreply@google.com')) return null
  const text = `${mail.Subject ?? ''}\n${mail.TextBody ?? ''}\n${mail.HtmlBody ?? ''}`
  const code = text.match(/\(#(\d{6,12})\)/)?.[1] ?? text.match(/(?:확인 코드|Confirmation code)[^\d]{0,10}(\d{6,12})/i)?.[1] ?? null
  const link = text.match(/https:\/\/(?:mail-settings|mail|isolated\.mail)\.google\.com\/mail\/[^\s"'<>]+/)?.[0]?.replace(/&amp;/g, '&') ?? null
  return { code, link }
}

function cleanSubject(s: string) {
  return s
    .replace(/^\s*((re|fw|fwd|회신|전달)\s*[:：]\s*)+/i, '')
    .replace(/^\s*[\[【(]?\s*(보도\s*(참고)?\s*자료|press\s*release)\s*[\]】)]?\s*[:：-]?\s*/i, '')
    .trim()
}

// 기자가 직접 "전달"을 누른 메일이면 원래 보낸 사람과 본문만 남긴다
function unwrapForward(text: string) {
  const marker = /^[\s>-]*(-{2,}\s*(Forwarded message|Original Message|전달된 메시지|원본 메시지)\s*-{2,}|-{3,}\s*Original Message\s*-{3,})\s*$/im
  const m = text.match(marker)
  if (!m || m.index === undefined) return { text, from: null as string | null }
  const rest = text.slice(m.index + m[0].length)
  const lines = rest.split('\n')
  let from: string | null = null
  let i = 0
  // 머리글(보낸 사람, 날짜, 제목, 받는 사람…)은 빈 줄이 나올 때까지
  for (; i < Math.min(lines.length, 12); i++) {
    const line = lines[i].replace(/^>\s?/, '').trim()
    if (!line) { if (from) break; continue }
    const f = line.match(/^(From|보낸\s*사람|보낸사람)\s*[:：]\s*(.+)$/i)
    if (f) from = f[2].trim()
  }
  return { text: lines.slice(i).map((l) => l.replace(/^>\s?/, '')).join('\n'), from }
}

function nameOf(from: string) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>/)
  if (m) return m[1].trim()
  const addr = from.match(/[^\s<]+@([^\s>]+)/)
  return addr ? addr[1] : from.trim()
}

// 메일 끝의 서명·연락처·수신거부 안내는 기사에 쓰지 않으므로 자른다
function trimTail(text: string) {
  const cut = text.search(/^\s*(수신\s*거부|수신을\s*원하지|본\s*메일은\s*발신\s*전용|이\s*메일은\s*발신\s*전용|unsubscribe)/im)
  return cut > 40 ? text.slice(0, cut) : text
}


// ───────── 묶음 메일 나누기 ─────────
// 지자체 보도자료 담당 부서는 하루치를 한 통에 묶어 보낸다. 모양: 번호만 있는 줄("1") → 제목 줄 → "보도일시 …" 줄 → 본문 … → 다음 번호("2")
//   1, 2, 3 … 순서로 번호 줄이 이어지고 제목 바로 뒤에 "보도일시"가 나오는 것만 묶음으로 본다 (모양이 다르면 나누지 않고 한 건으로 둔다)
export function splitBundle(paras: string[]): { n: number; title: string; paras: string[] }[] | null {
  const marks: number[] = []
  let want = 1
  for (let i = 0; i < paras.length; i++) {
    if (paras[i].trim() === String(want) && paras.slice(i + 1, i + 4).some((p) => /^보도\s*일시/.test(p.trim()))) { marks.push(i); want++ }
  }
  if (marks.length < 2) return null
  // 끝은 첨부 내용이 시작되는 곳
  const tail = paras.findIndex((p, i) => i > marks[marks.length - 1] && /^첨부\s*파일(\s*내용)?(?=\s|$|\()/.test(p.trim()))
  const end = tail > 0 ? tail : paras.length
  return marks.map((m, k) => {
    const to = k + 1 < marks.length ? marks[k + 1] : end
    const body = paras.slice(m + 1, to)
    const title = (body[0] ?? '').trim()
    // 머리 정보(보도일시·담당부서·사진자료 표시)는 기사 재료가 아니라서 뺀다. 연락처가 든 담당부서 줄도 뺀다
    const rest = body.slice(1).filter((p) => !/^(보도\s*일시|사진\s*자료)/.test(p.trim()) && !/^[가-힣·\s]{2,20}\s*(과\s*장|팀\s*장|담\s*당)\s*:/.test(p.trim()))
    return { n: k + 1, title, paras: rest.filter((p) => p.trim()) }
  }).filter((x) => x.title && x.paras.length)
}

// 번호가 붙은 첨부 사진("4-2. 설명.jpg")은 그 번호의 보도자료에 붙인다
export const attachmentNumber = (name: string) => Number(/^\s*(\d{1,2})\s*[-.]/.exec(name)?.[1] ?? 0)

async function sha(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function parseInbound(mail: InboundMail): Promise<ParsedMail | null> {
  const token = tokenOf(mail)
  if (!token) return null

  const v = verification(mail)
  if (v) return { kind: 'verify', token, ...v }

  const rawText = mail.TextBody?.trim() || htmlToText(mail.HtmlBody ?? '')
  const unwrapped = unwrapForward(rawText)
  const text = trimTail(unwrapped.text).trim()
  const fromLine = unwrapped.from ?? (mail.FromFull?.Name ? `${mail.FromFull.Name} <${mail.FromFull.Email}>` : mail.From ?? '')
  const sourceName = (mail.FromFull?.Name && !unwrapped.from ? mail.FromFull.Name : nameOf(fromLine)) || '이메일 보도자료'

  const title = cleanSubject(mail.Subject ?? '') || textToParagraphs(text)[0]?.slice(0, 80) || '(제목 없음)'
  const allParas = textToParagraphs(text)
  const paras = allParas.slice(0, 80)
  const bodyHtml = paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')

  // 같은 자료가 기자 여러 명에게 오면 하나로 (보낸 곳 + 제목 + 날짜)
  const day = (mail.Date && !Number.isNaN(Date.parse(mail.Date)) ? new Date(mail.Date) : new Date()).toISOString().slice(0, 10)
  const guid = `email:${await sha(`${sourceName}|${title.replace(/\s+/g, '')}|${day}`)}`

  const attachments: { name: string; content_type: string; size: number; content: string }[] = []
  const skipped: string[] = []
  let total = 0
  const ordered = [...(mail.Attachments ?? [])].sort((a, b) => Number(isImageAttachment(b.ContentType ?? '', b.Name ?? '')) - Number(isImageAttachment(a.ContentType ?? '', a.Name ?? '')))
  for (const a of ordered) {
    const name = a.Name ?? '첨부파일'
    const type = a.ContentType ?? 'application/octet-stream'
    const size = a.ContentLength ?? Math.floor(((a.Content?.length ?? 0) * 3) / 4)
    if (!a.Content || !(KEEP_TYPES.test(type) || KEEP_EXT.test(name))) { skipped.push(name); continue }
    if (total + size > MAX_TOTAL) { skipped.push(name); continue }
    total += size
    attachments.push({ name, content_type: type, size, content: a.Content })
  }

  // 묶음 메일이면 한 건씩 나눈다 (한 건씩 글자 80문단까지)
  const day2 = day
  const parts = splitBundle(allParas)
  const items: BundleItem[] | undefined = parts && parts.length >= 2
    ? await Promise.all(parts.map(async (x) => ({
        n: x.n,
        title: x.title.slice(0, 300),
        summary: x.paras.join(' ').slice(0, 400),
        bodyHtml: x.paras.slice(0, 80).map((p) => `<p>${escapeHtml(p)}</p>`).join(''),
        guid: `email:${await sha(`${sourceName}|${x.title.replace(/\s+/g, '')}|${day2}`)}`,
      })))
    : undefined

  return {
    kind: 'release',
    token,
    items,
    sourceName: sourceName.slice(0, 80),
    guid,
    title: title.slice(0, 300),
    summary: paras.join(' ').slice(0, 400),
    bodyHtml: bodyHtml || '<p>(본문 없음 — 첨부파일을 확인하세요)</p>',
    publishedAt: mail.Date && !Number.isNaN(Date.parse(mail.Date)) ? new Date(mail.Date).toISOString() : null,
    attachments,
    skipped,
  }
}

// 광고 메일: 제목 맨 앞에 (광고)·[광고]·(AD) 표시가 있는 메일. 광고성 정보 전송은 제목에 이 표시를 달아야 해서, 보도자료함에는 받지 않는다
//   (Re:·Fwd: 뒤에 붙은 것도 포함). 보도자료를 보내는 홍보 담당자는 이 표시를 달지 않는다
export const AD_SUBJECT = /^\s*(?:(?:re|fwd?|회신|전달)\s*:\s*)*[(\[（【<]\s*(?:광\s*고|ad|advertisement)\s*[)\]）】>]/i
export const isAdMail = (title: string | null | undefined) => AD_SUBJECT.test(title ?? '')

// 받지 않을 보낸 곳(도메인): 쇼핑·서비스 알림처럼 보도자료가 아닌 메일. 지메일 전달 필터가 받은편지함 전체를 넘겨 올 때 걸러 준다
//   하위 주소(notice.aliexpress.com 등)도 함께 막는다. 더 막을 곳이 생기면 여기에 도메인만 추가한다
// (github.com: 깃허브 알림 메일 — vercel[bot] 등이 보낸 것처럼 보이는 PR 알림)
export const BLOCKED_SENDER_DOMAINS = ['aliexpress.com', 'alibaba.com', 'alibaba-inc.com', 'tiktok.com', 'openai.com', 'vercel.com', 'github.com', 'google.com']
// 보낸 사람 이름으로도 막는다 (광고 대행 서비스로 보내서 주소가 매번 다른 곳). 이름의 띄어쓰기·대소문자는 무시한다
//   예: 알파컷(영상 편집 서비스 광고). 더 막을 곳이 생기면 여기에 이름만 추가한다
export const BLOCKED_SENDER_NAMES = ['알파컷', 'Google Alerts', 'Google 알리미']
const squash = (v: string) => v.replace(/\s+/g, '').toLowerCase()
// 받은 메일에서 읽어 낸 보낸 곳 이름(전달 메일이면 원래 보낸 곳)이 막아 둔 이름인지
export const isBlockedSourceName = (name: string | null | undefined) => { const n = squash(name ?? ''); return !!n && BLOCKED_SENDER_NAMES.some((b) => n.includes(squash(b))) }
export function isBlockedSender(mail: Pick<InboundMail, 'From' | 'FromFull'>) {
  const addr = (mail.FromFull?.Email ?? /<([^>]+)>/.exec(mail.From ?? '')?.[1] ?? mail.From ?? '').trim().toLowerCase()
  const domain = addr.split('@')[1] ?? ''
  if (!!domain && BLOCKED_SENDER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return true
  const name = squash(mail.FromFull?.Name ?? (mail.From ?? '').replace(/<[^>]*>/, '').replace(/["']/g, ''))
  return !!name && BLOCKED_SENDER_NAMES.some((n) => name.includes(squash(n)))
}

// 보도자료가 아닌 일정·공지 메일: 제목에 이 말이 들어 있으면 받지 않는다 (예: "화성특례시 주간행사계획(…) 송부")
//   행사 일정표는 기사 재료가 아니고 PDF 표 글자도 깨져서 보도자료함을 어지럽힌다. 더 막을 말이 생기면 여기에 추가한다
export const NON_PRESS_TITLE_WORDS = ['Google 알리미', 'Google Alert', '주간행사계획', '주간 행사 계획', '주간일정', '주간 일정표', '행사계획 송부']
export const isNonPressTitle = (title: string | null | undefined) => {
  const t = (title ?? '').replace(/\s+/g, '')
  return NON_PRESS_TITLE_WORDS.some((w) => t.includes(w.replace(/\s+/g, '')))
}
