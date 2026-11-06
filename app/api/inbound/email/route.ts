import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { attachmentNumber, isAdMail, isBlockedSender, isNonPressTitle, parseInbound, type InboundMail } from '@/lib/press-email'
import { resendInboundMail, verifyResendWebhook } from '@/lib/resend-inbound'

// 메일 수신 서비스가 메일 한 통마다 부른다. 주소의 ?key= 값을 DB 비밀 열쇠와 대조한다
//   Resend(웹훅 email.received → 본문은 API로 다시 받음, RESEND_WEBHOOK_SECRET 이 있으면 서명도 확인) 또는 Postmark 인바운드 형식
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('key')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) { console.error('[inbound-email] 주소에 ?key= 가 없습니다'); return NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const raw = await req.text()
  let payload: (InboundMail & { type?: string; data?: { email_id?: string } }) | null = null
  try {
    payload = JSON.parse(raw)
  } catch {
    console.error('[inbound-email] 본문이 JSON 이 아닙니다')
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }
  let mail: InboundMail
  if (payload?.type) {
    // Resend
    if (payload.type !== 'email.received' || !payload.data?.email_id) return NextResponse.json({ result: 'ignored' })
    const whSecret = process.env.RESEND_WEBHOOK_SECRET
    if (whSecret && !verifyResendWebhook(raw, req.headers, whSecret)) { console.error('[inbound-email] Resend 웹훅 서명이 맞지 않습니다 (RESEND_WEBHOOK_SECRET 값을 Resend 의 서명 비밀값과 맞춰 주세요)'); return NextResponse.json({ error: 'bad signature' }, { status: 401 }) }
    if (!process.env.RESEND_API_KEY) { console.error('[inbound-email] RESEND_API_KEY 가 설정되어 있지 않습니다'); return NextResponse.json({ error: 'not configured' }, { status: 503 }) }
    try {
      mail = await resendInboundMail(payload.data.email_id)
    } catch (e) {
      console.error('[inbound-email] 받은 메일 내용을 Resend 에서 읽지 못했습니다:', e instanceof Error ? e.message : e)
      // Resend 웹훅 화면의 Response body 에 이유가 보이도록 (비밀 값은 들어 있지 않다)
      return NextResponse.json({ error: 'fetch_failed', detail: e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300) }, { status: 500 })
    }
  } else {
    mail = payload as InboundMail
  }

  const parsed = await parseInbound(mail)
  // 누구 주소인지 알 수 없는 메일은 다시 보내봐야 소용없으니 받은 것으로 처리한다
  if (!parsed) { console.error('[inbound-email] 받는 주소에서 전용 주소 토큰(press+토큰@)을 찾지 못했습니다'); return NextResponse.json({ result: 'no_token' }) }

  // 광고 메일((광고)·[광고] 표시)은 받지 않는다. 저장하지 않으므로 하루 한도(100건)에도 세지 않는다
  if (parsed.kind === 'release' && isAdMail(parsed.title)) return NextResponse.json({ result: 'ad_skipped' })
  // 행사 일정표·공지 메일은 보도자료가 아니라서 받지 않는다
  if (parsed.kind === 'release' && isNonPressTitle(parsed.title)) return NextResponse.json({ result: 'not_press' })
  // 막아 둔 보낸 곳(AliExpress 등 쇼핑·서비스 알림)도 받지 않는다
  if (parsed.kind === 'release' && isBlockedSender(mail)) return NextResponse.json({ result: 'sender_blocked' })

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

  // "취재지원자료 총N건"처럼 한 통에 보도자료가 여러 건 묶여 온 메일은 한 건씩 나눠 저장한다
  //   번호가 붙은 첨부 사진("4-2. 설명.jpg")은 그 번호의 보도자료에만 붙이고, 번호 없는 첨부(전체 자료 파일 등)는 글자만 본문에 옮겨져 있어 따로 저장하지 않는다
  if (parsed.kind === 'release' && parsed.items?.length) {
    const results: unknown[] = []
    for (const it of parsed.items) {
      const own = parsed.attachments.filter((a) => attachmentNumber(a.name) === it.n)
      const one = { ...args, p_guid: it.guid, p_title: it.title, p_summary: it.summary, p_body_html: it.bodyHtml, p_attachments: own }
      let r = await supabase.rpc('press_ingest_email', { secret, p_token: parsed.token, ...one })
      if (r.error && own.length) r = await supabase.rpc('press_ingest_email', { secret, p_token: parsed.token, ...one, p_attachments: [] })
      if (r.error) {
        console.error('[inbound-email] 묶음 메일 저장 실패:', r.error.message)
        return NextResponse.json({ error: /forbidden/.test(r.error.message) ? 'unauthorized' : 'save_failed' }, { status: /forbidden/.test(r.error.message) ? 401 : 500 })
      }
      results.push(r.data)
      if (r.data === 'addon_required') break   // 이용 한도를 넘었으면 나머지는 시도하지 않는다
    }
    console.log('[inbound-email] 묶음 메일 처리 결과:', results.join(','))
    return NextResponse.json({ result: 'bundle', items: results })
  }

  let { data, error } = await supabase.rpc('press_ingest_email', { secret, p_token: parsed.token, ...args })
  // 첨부가 너무 커서 저장하지 못했으면 본문만이라도 저장한다 (첨부는 이름만 남긴다)
  if (error && parsed.kind === 'release' && parsed.attachments.length) {
    console.error('[inbound-email] 첨부를 포함한 저장이 실패해 본문만 저장합니다:', error.message)
    mail.AttachNotes = [...(mail.AttachNotes ?? []), `첨부 포함 저장 실패: ${error.message.slice(0, 160)}`]
    const names = parsed.attachments.map((a) => a.name.replace(/[<>&]/g, '')).join(', ')
    ;({ data, error } = await supabase.rpc('press_ingest_email', {
      secret, p_token: parsed.token, ...args,
      p_attachments: [],
      p_body_html: `${args.p_body_html}<p><em>※ 첨부파일(${names})이 너무 커서 가져오지 못했습니다 — 받은 메일에서 확인하세요.</em></p>`,
    }))
  }
  if (error) {
    console.error('[inbound-email] 저장 실패:', error.message)
    const status = /forbidden/.test(error.message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'save_failed' }, { status })
  }
  console.log('[inbound-email] 처리 결과:', data, parsed.kind, mail.AttachNotes?.join(' / ') ?? '')
  return NextResponse.json({ result: data, ...(mail.AttachNotes?.length ? { attachments: mail.AttachNotes } : {}) })
}
