// 메일 보내기 (Postmark). 보도자료 “메일로 받기”와 같은 Postmark 계정을 쓴다
//   환경 변수: POSTMARK_SERVER_TOKEN, MAIL_FROM (예: "IM 뉴스룸 <noreply@보내는도메인>" — Postmark에서 확인한 도메인)
//   POSTMARK_BROADCAST_STREAM: 뉴스레터용 스트림 ID (기본 "broadcast"). 알림 메일은 "outbound"
//   설정 전이면 보내지 않고 조용히 넘어간다 (편집국 기능은 그대로 동작)
const API = 'https://api.postmarkapp.com'

export const mailReady = () => !!(process.env.POSTMARK_SERVER_TOKEN && process.env.MAIL_FROM)

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

// 여러 통을 500통씩 나눠 보낸다. 돌려주는 값: 보낸 수·실패 수·첫 오류
export async function sendMails(mails: Mail[], stream: 'outbound' | 'broadcast' = 'outbound') {
  const result = { sent: 0, failed: 0, error: null as string | null }
  if (!mailReady() || !mails.length) return result
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
      const res = await fetch(`${API}/email/batch`, {
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
  return result
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
