import type { SupabaseClient } from '@supabase/supabase-js'
import { mailReady, noticeMail, sendMails, type Mail } from './mail'
import { paymentDbSecret } from './toss'

// 알림 메일 보내기 (supabase/mail.sql). 받는 사람은 DB가 정하고(서버 열쇠로만), 같은 열쇠의 알림은 한 번만 나간다
//   메일 설정·SQL 전이면 아무 일도 하지 않는다. 실패해도 편집국 작업은 막지 않는다
export type NoticeKind = 'article_submitted' | 'article_rejected' | 'article_published' | 'ticket_staff_reply' | 'ticket_customer_reply' | 'invoice_issued' | 'invoice_overdue' | 'invoice_hold'

export async function notify(
  supabase: SupabaseClient,
  kind: NoticeKind,
  ref: string,
  dedupeKey: string,
  build: (to: { email: string; name: string | null }) => { subject: string; title: string; lines: string[]; button?: { label: string; url: string }; footer?: string },
) {
  if (!mailReady() || !process.env.PAYMENT_DB_SECRET) return
  try {
    const secret = paymentDbSecret()
    const { data: logId, error } = await supabase.rpc('mail_claim', { secret, p_kind: kind, p_ref: ref, p_key: dedupeKey })
    if (error || logId == null) return
    const { data: rows } = await supabase.rpc('mail_recipients', { secret, p_kind: kind, p_ref: ref })
    const mails: Mail[] = ((rows ?? []) as { email: string; name: string | null }[])
      .filter((r) => r.email)
      .map((r) => {
        const m = build(r)
        const { html, text } = noticeMail(m)
        return { to: r.email, subject: m.subject, html, text, tag: kind }
      })
    const res = await sendMails(mails)
    await supabase.rpc('mail_done', { secret, p_id: logId, p_sent: res.sent, p_failed: res.failed, p_error: res.error })
  } catch {
    // 알림 실패는 조용히 넘긴다
  }
}
