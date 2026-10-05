import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { kstToday, runBilling, runDunning } from '@/lib/billing'
import { cmsOrigin } from '@/lib/origin'

// 매일 0시~0시 50분(한국) 10분마다 Supabase 예약 작업(billing-auto.sql·scale.sql)이 부른다: 자동 청구를 켠 매체의 이번 달 청구서가 없으면 만든다
//   예약 작업 열쇠(press_cron_secret)로 확인하고, 청구서는 PAYMENT_DB_SECRET 으로만 만든다
export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret: cronSecret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!process.env.PAYMENT_DB_SECRET) return NextResponse.json({ ok: true, skipped: 'PAYMENT_DB_SECRET 없음' })

  try {
    // 2분 제한 안에 끝나도록 100초가 지나면 멈춘다 (남은 매체는 다음 예약 실행이 이어서)
    const result = await runBilling(supabase, kstToday().slice(0, 7), cmsOrigin(), Date.now() + 100_000)
    // 미납 처리: 유예가 지난 매체 이용 제한, 미납·제한 안내 (billing-dunning.sql 전이면 오류만 돌려준다)
    const dunning = await runDunning(supabase, cmsOrigin())
    return NextResponse.json({ ok: true, ...result, dunning })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
