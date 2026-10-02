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
}

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
    }

// 첨부는 사진·문서만, 한 통에 합계 3MB까지 (서버가 받을 수 있는 요청 크기 한도 때문)
const MAX_TOTAL = 3 * 1024 * 1024
const KEEP_TYPES = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/(x-)?hwp|application\/haansofthwp|application\/vnd\.hancom\.hwpx|application\/octet-stream)$/i
const KEEP_EXT = /\.(jpe?g|png|webp|gif|pdf|hwp|hwpx|docx?)$/i

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
  const paras = textToParagraphs(text).slice(0, 80)
  const bodyHtml = paras.map((p) => `<p>${escapeHtml(p)}</p>`).join('')

  // 같은 자료가 기자 여러 명에게 오면 하나로 (보낸 곳 + 제목 + 날짜)
  const day = (mail.Date && !Number.isNaN(Date.parse(mail.Date)) ? new Date(mail.Date) : new Date()).toISOString().slice(0, 10)
  const guid = `email:${await sha(`${sourceName}|${title.replace(/\s+/g, '')}|${day}`)}`

  const attachments: { name: string; content_type: string; size: number; content: string }[] = []
  const skipped: string[] = []
  let total = 0
  for (const a of mail.Attachments ?? []) {
    const name = a.Name ?? '첨부파일'
    const type = a.ContentType ?? 'application/octet-stream'
    const size = a.ContentLength ?? Math.floor(((a.Content?.length ?? 0) * 3) / 4)
    if (!a.Content || !(KEEP_TYPES.test(type) || KEEP_EXT.test(name))) { skipped.push(name); continue }
    if (total + size > MAX_TOTAL) { skipped.push(name); continue }
    total += size
    attachments.push({ name, content_type: type, size, content: a.Content })
  }

  return {
    kind: 'release',
    token,
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
