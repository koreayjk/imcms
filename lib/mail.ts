// 메일 보내기. RESEND_API_KEY 가 있으면 Resend, 없고 POSTMARK_SERVER_TOKEN 이 있으면 Postmark
//   환경 변수: RESEND_API_KEY, MAIL_FROM (예: "IM 뉴스룸 <noreply@보내는도메인>" — Resend에서 확인한 도메인)
//   (Postmark를 쓸 때) POSTMARK_SERVER_TOKEN, POSTMARK_BROADCAST_STREAM(뉴스레터 스트림, 기본 "broadcast")
//   설정 전이면 보내지 않고 조용히 넘어간다 (편집국 기능은 그대로 동작)
const provider = () => (process.env.RESEND_API_KEY ? 'resend' : process.env.POSTMARK_SERVER_TOKEN ? 'postmark' : null)
export const mailReady = () => !!(provider() && process.env.MAIL_FROM)

export type Mail = {
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string | null
  // 보내는 이름 (예: 매체 이름). 주소는 MAIL_FROM 그대로
  fromName?: string
  tag?: string
  headers?: Record<string, string>
}

function fromWithName(name?: string) {
  const from = process.env.MAIL_FROM ?? ''
  if (!name) return from
  const addr = from.match(/<([^>]+)>/)?.[1] ?? from
  return `${name.replace(/["<>\r\n]/g, '').slice(0, 60)} <${addr}>`
}

type SendResult = { sent: number; failed: number; error: string | null }

// 여러 통을 나눠 보낸다 (Resend 100통씩, Postmark 500통씩). 돌려주는 값: 보낸 수·실패 수·첫 오류
export async function sendMails(mails: Mail[], stream: 'outbound' | 'broadcast' = 'outbound'): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, error: null }
  if (!mailReady() || !mails.length) return result
  if (provider() === 'resend') await sendResend(mails, result)
  else await sendPostmark(mails, stream, result)
  return result
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
// Resend 태그는 영문·숫자·_·- 만
const tagValue = (t: string) => t.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 256)

async function sendResend(mails: Mail[], result: SendResult) {
  for (let i = 0; i < mails.length; i += 100) {
    const chunk = mails.slice(i, i + 100).map((m) => ({
      from: fromWithName(m.fromName),
      to: [m.to],
      subject: m.subject.slice(0, 200),
      html: m.html,
      text: m.text,
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      ...(m.headers ? { headers: m.headers } : {}),
      ...(m.tag ? { tags: [{ name: 'type', value: tagValue(m.tag) }] } : {}),
    }))
    // 초당 요청 수 제한(기본 10회)에 걸리면 잠시 쉬고 다시 (최대 3번)
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'im-newsroom/1.0' },
          body: JSON.stringify(chunk),
          cache: 'no-store',
        })
        if (res.status === 429 && attempt < 3) { await sleep(1000 * (attempt + 1)); continue }
        const data = await res.json().catch(() => null) as { data?: { id: string }[]; message?: string } | null
        if (!res.ok) { result.failed += chunk.length; result.error ??= data?.message ?? `HTTP ${res.status}`; break }
        const ok = data?.data?.length ?? chunk.length
        result.sent += ok
        result.failed += chunk.length - ok
        break
      } catch (e) {
        result.failed += chunk.length
        result.error ??= e instanceof Error ? e.message : '메일 서버에 연결하지 못했습니다.'
        break
      }
    }
    if (i + 100 < mails.length) await sleep(150)
  }
}

async function sendPostmark(mails: Mail[], stream: 'outbound' | 'broadcast', result: SendResult) {
  const streamId = stream === 'broadcast' ? process.env.POSTMARK_BROADCAST_STREAM || 'broadcast' : 'outbound'
  for (let i = 0; i < mails.length; i += 500) {
    const chunk = mails.slice(i, i + 500).map((m) => ({
      From: fromWithName(m.fromName),
      To: m.to,
      Subject: m.subject.slice(0, 200),
      HtmlBody: m.html,
      TextBody: m.text,
      ...(m.replyTo ? { ReplyTo: m.replyTo } : {}),
      ...(m.tag ? { Tag: m.tag } : {}),
      ...(m.headers ? { Headers: Object.entries(m.headers).map(([Name, Value]) => ({ Name, Value })) } : {}),
      MessageStream: streamId,
    }))
    try {
      const res = await fetch('https://api.postmarkapp.com/email/batch', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN! },
        body: JSON.stringify(chunk),
        cache: 'no-store',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !Array.isArray(data)) {
        result.failed += chunk.length
        result.error ??= (data as { Message?: string } | null)?.Message ?? `HTTP ${res.status}`
        continue
      }
      for (const r of data as { ErrorCode: number; Message: string }[]) {
        if (r.ErrorCode === 0) result.sent++
        else { result.failed++; result.error ??= r.Message }
      }
    } catch (e) {
      result.failed += chunk.length
      result.error ??= e instanceof Error ? e.message : '메일 서버에 연결하지 못했습니다.'
    }
  }
}

// ───────── 메일 본문 틀 ─────────
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 알림 메일 (제목, 문단들, 버튼 하나)
export function noticeMail(o: { title: string; lines: string[]; button?: { label: string; url: string }; footer?: string }) {
  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#F4F5F7;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#14171C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">
<tr><td style="font-size:13px;font-weight:700;color:#E5483A">IM 뉴스룸</td></tr>
<tr><td style="padding-top:10px;font-size:20px;font-weight:800;line-height:1.4">${esc(o.title)}</td></tr>
${o.lines.map((l) => `<tr><td style="padding-top:12px;font-size:15px;line-height:1.7;color:#3B4048">${esc(l)}</td></tr>`).join('')}
${o.button ? `<tr><td style="padding-top:22px"><a href="${esc(o.button.url)}" style="display:inline-block;background:#14171C;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 20px;border-radius:8px">${esc(o.button.label)}</a></td></tr>` : ''}
<tr><td style="padding-top:26px;font-size:12px;line-height:1.6;color:#8A9099">${esc(o.footer ?? '이 메일은 IM 뉴스룸 편집국 알림입니다. 알림 메일은 편집국 “내 정보”에서 끌 수 있습니다.')}</td></tr>
</table></td></tr></table></body></html>`
  const text = [o.title, '', ...o.lines, ...(o.button ? ['', `${o.button.label}: ${o.button.url}`] : []), '', o.footer ?? '알림 메일은 편집국 “내 정보”에서 끌 수 있습니다.'].join('\n')
  return { html, text }
}

// 첨부 파일이 있는 메일 한 통 (견적서·게재 확인서 PDF). Resend 묶음 보내기는 첨부를 못 써서 따로 보낸다
export type Attachment = { filename: string; content: string /* base64 */; contentType?: string }
export async function sendMailWithAttachments(m: Omit<Mail, 'to'> & { to: string[]; cc?: string[]; attachments: Attachment[] }): Promise<{ ok: boolean; error: string | null }> {
  if (!mailReady()) return { ok: false, error: '메일 발송이 아직 설정되지 않았습니다 (RESEND_API_KEY·MAIL_FROM).' }
  try {
    if (provider() === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'User-Agent': 'im-newsroom/1.0' },
        body: JSON.stringify({
          from: fromWithName(m.fromName), to: m.to, ...(m.cc?.length ? { cc: m.cc } : {}),
          subject: m.subject.slice(0, 200), html: m.html, text: m.text,
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
          ...(m.tag ? { tags: [{ name: 'type', value: tagValue(m.tag) }] } : {}),
          attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content })),
        }),
        cache: 'no-store',
      })
      if (!res.ok) return { ok: false, error: ((await res.json().catch(() => null)) as { message?: string } | null)?.message ?? `HTTP ${res.status}` }
      return { ok: true, error: null }
    }
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN!, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        From: fromWithName(m.fromName), To: m.to.join(','), ...(m.cc?.length ? { Cc: m.cc.join(',') } : {}),
        Subject: m.subject.slice(0, 200), HtmlBody: m.html, TextBody: m.text, ...(m.replyTo ? { ReplyTo: m.replyTo } : {}),
        MessageStream: 'outbound',
        Attachments: m.attachments.map((a) => ({ Name: a.filename, Content: a.content, ContentType: a.contentType ?? 'application/octet-stream' })),
      }),
      cache: 'no-store',
    })
    if (!res.ok) return { ok: false, error: ((await res.json().catch(() => null)) as { Message?: string } | null)?.Message ?? `HTTP ${res.status}` }
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '메일 서버에 연결하지 못했습니다.' }
  }
}
