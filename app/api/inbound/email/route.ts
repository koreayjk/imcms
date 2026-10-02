import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseInbound, type InboundMail } from '@/lib/press-email'
import { resendInboundMail, verifyResendWebhook } from '@/lib/resend-inbound'

// 메일 수신 서비스가 메일 한 통마다 부른다. 주소의 ?key= 값을 DB 비밀 열쇠와 대조한다
//   Resend(웹훅 email.received → 본문은 API로 다시 받음, RESEND_WEBHOOK_SECRET 이 있으면 서명도 확인) 또는 Postmark 인바운드 형식
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('key')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw = await req.text()
  let payload: (InboundMail & { type?: string; data?: { email_id?: string } }) | null = null
  try {
    payload = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  let mail: InboundMail
  if (payload?.type) {
    // Resend
    if (payload.type !== 'email.received' || !payload.data?.email_id) return NextResponse.json({ result: 'ignored' })
    const whSecret = process.env.RESEND_WEBHOOK_SECRET
    if (whSecret && !verifyResendWebhook(raw, req.headers, whSecret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 })
    if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: 'not configured' }, { status: 503 })
    try {
      mail = await resendInboundMail(payload.data.email_id)
    } catch {
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 })
    }
  } else {
    mail = payload as InboundMail
  }

  const parsed = await parseInbound(mail)
  // 누구 주소인지 알 수 없는 메일은 다시 보내봐야 소용없으니 받은 것으로 처리한다
  if (!parsed) return NextResponse.json({ result: 'no_token' })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const args =
    parsed.kind === 'verify'
      ? { p_kind: 'verify', p_verify_code: parsed.code, p_verify_link: parsed.link, p_source_name: null, p_guid: null, p_title: null, p_summary: null, p_body_html: null, p_published_at: null, p_attachments: null }
      : {
          p_kind: 'release',
          p_verify_code: null,
          p_verify_link: null,
          p_source_name: parsed.sourceName,
          p_guid: parsed.guid,
          p_title: parsed.title,
          p_summary: parsed.summary,
          p_body_html: parsed.skipped.length
            ? `${parsed.bodyHtml}<p><em>※ 메일 첨부 중 가져오지 못한 파일: ${parsed.skipped.map((s) => s.replace(/[<>&]/g, '')).join(', ')} — 받은 메일에서 확인하세요.</em></p>`
            : parsed.bodyHtml,
          p_published_at: parsed.publishedAt,
          p_attachments: parsed.attachments,
        }

  let { data, error } = await supabase.rpc('press_ingest_email', { secret, p_token: parsed.token, ...args })
  // 첨부가 너무 커서 저장하지 못했으면 본문만이라도 저장한다 (첨부는 이름만 남긴다)
  if (error && parsed.kind === 'release' && parsed.attachments.length) {
    const names = parsed.attachments.map((a) => a.name.replace(/[<>&]/g, '')).join(', ')
    ;({ data, error } = await supabase.rpc('press_ingest_email', {
      secret, p_token: parsed.token, ...args,
      p_attachments: [],
      p_body_html: `${args.p_body_html}<p><em>※ 첨부파일(${names})이 너무 커서 가져오지 못했습니다 — 받은 메일에서 확인하세요.</em></p>`,
    }))
  }
  if (error) {
    const status = /forbidden/.test(error.message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'save_failed' }, { status })
  }
  return NextResponse.json({ result: data })
}
