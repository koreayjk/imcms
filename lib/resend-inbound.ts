import { createHmac, timingSafeEqual } from 'node:crypto'
import { MAX_ATTACH_TOTAL, isImageAttachment, type InboundMail } from './press-email'

// Resend 받은 메일 → 보도자료 메일 처리(press-email.ts)가 읽는 형식으로 바꾼다
//   웹훅에는 본문이 없어서(메타데이터만) API로 본문·첨부를 다시 받아 온다
const API = 'https://api.resend.com'
const headers = () => ({ Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'User-Agent': 'im-newsroom/1.0' })

// 웹훅 서명 확인 (Svix 방식: "아이디.시각.본문"을 HMAC-SHA256, 5분 안의 요청만)
export function verifyResendWebhook(body: string, h: Headers, secret: string) {
  const id = h.get('svix-id'), ts = h.get('svix-timestamp'), sig = h.get('svix-signature')
  if (!id || !ts || !sig) return false
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest()
  return sig.split(' ').some((part) => {
    const [ver, value] = part.split(',')
    if (ver !== 'v1' || !value) return false
    const got = Buffer.from(value, 'base64')
    return got.length === expected.length && timingSafeEqual(got, expected)
  })
}

type Received = {
  id: string; from: string; to: string[]; received_for?: string[] | null; subject: string | null
  html: string | null; text: string | null; headers?: Record<string, string> | null; message_id?: string | null; created_at: string
}
type Att = { id: string; filename: string | null; size: number; content_type: string | null; download_url: string }

const KEEP = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/(x-)?hwp|application\/haansofthwp|application\/vnd\.hancom\.hwpx|application\/octet-stream|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/i
const KEEP_EXT = /\.(jpe?g|png|webp|gif|pdf|hwp|hwpx|docx?)$/i

export async function resendInboundMail(emailId: string): Promise<InboundMail> {
  const res = await fetch(`${API}/emails/receiving/${encodeURIComponent(emailId)}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`받은 메일을 읽지 못했습니다 (HTTP ${res.status})`)
  const m = (await res.json()) as Received
  const fromHeader = m.headers?.from ?? m.from
  const name = fromHeader.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim()

  // 첨부: 사진·문서만, 사진부터 합계 15MB까지 내려받는다 (나머지는 이름만 남는다)
  const attachments: InboundMail['Attachments'] = []
  const list = await fetch(`${API}/emails/receiving/${encodeURIComponent(emailId)}/attachments?limit=50`, { headers: headers(), cache: 'no-store' })
  if (list.ok) {
    const { data } = (await list.json()) as { data: Att[] }
    let total = 0
    const ordered = [...(data ?? [])].sort((x, y) => Number(isImageAttachment(y.content_type ?? '', y.filename ?? '')) - Number(isImageAttachment(x.content_type ?? '', x.filename ?? '')))
    for (const a of ordered) {
      const nameOf = a.filename ?? '첨부파일'
      const type = a.content_type ?? 'application/octet-stream'
      if (!(KEEP.test(type) || KEEP_EXT.test(nameOf)) || total + a.size > MAX_ATTACH_TOTAL) {
        attachments.push({ Name: nameOf, ContentType: type, ContentLength: a.size }) // 내용 없이 → “가져오지 못한 파일”로 표시
        continue
      }
      try {
        const file = await fetch(a.download_url, { cache: 'no-store' })
        if (!file.ok) throw new Error()
        const buf = Buffer.from(await file.arrayBuffer())
        total += buf.length
        attachments.push({ Name: nameOf, ContentType: type, ContentLength: buf.length, Content: buf.toString('base64') })
      } catch {
        attachments.push({ Name: nameOf, ContentType: type, ContentLength: a.size })
      }
    }
  }

  return {
    From: m.from,
    FromName: name,
    FromFull: { Email: fromHeader.match(/<([^>]+)>/)?.[1] ?? m.from, Name: name },
    To: (m.to ?? []).join(','),
    OriginalRecipient: (m.received_for?.length ? m.received_for : m.to ?? []).join(','),
    Subject: m.subject ?? '',
    MessageID: m.message_id ?? undefined,
    Date: m.headers?.date ?? m.created_at,
    TextBody: m.text ?? undefined,
    HtmlBody: m.html ?? undefined,
    Attachments: attachments,
  }
}
