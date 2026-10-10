import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notify } from '@/lib/notify'
import { cmsOrigin } from '@/lib/origin'
import { paymentDbSecret } from '@/lib/toss'

// 무료 체험 5일째 자동 안내 (trial-checkin.sql): Supabase 예약 작업이 매일 아침 부른다
//   보낼 사람에게 고객센터 '운영팀 안내'를 만들고(DB), 받은 사람에게 알림 메일을 보낸다
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.PAYMENT_DB_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase.rpc('trial_checkin_run', { secret: paymentDbSecret() })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data ?? []) as { ticket_id: string; title: string; body: string }[]
  const origin = await cmsOrigin()
  for (const r of rows) {
    await notify(supabase, 'ticket_staff_reply', r.ticket_id, `staffmsg:${r.ticket_id}`, () => ({
      subject: `[IM 뉴스룸] ${r.title}`,
      title: 'IM 뉴스룸 운영팀이 안내를 보냈습니다',
      lines: [`“${r.title}”`, r.body.length > 300 ? `${r.body.slice(0, 300)}…` : r.body],
      button: { label: '고객센터에서 보기', url: `${origin}/support/tickets/${r.ticket_id}` },
    }))
  }
  return NextResponse.json({ at: new Date().toISOString(), sent: rows.length })
}
