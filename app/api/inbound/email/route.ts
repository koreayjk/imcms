import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseInbound, type InboundMail } from '@/lib/press-email'

// 메일 수신 서비스(Postmark 인바운드)가 메일 한 통마다 부른다. 주소의 ?key= 값을 DB 비밀 열쇠와 대조한다
export const maxDuration = 30
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('key')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let mail: InboundMail
  try {
    mail = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
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

  const { data, error } = await supabase.rpc('press_ingest_email', { secret, p_token: parsed.token, ...args })
  if (error) {
    const status = /forbidden/.test(error.message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'save_failed' }, { status })
  }
  return NextResponse.json({ result: data })
}
