import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordFailure, recordPayment } from '@/lib/payments'
import { billingReady, chargeBilling, paymentDbSecret, TossError } from '@/lib/toss'

// 매일 오전 10시(한국) Supabase 예약 작업(payments.sql)이 부른다: 납부 기한이 된 미납 청구서를 등록된 카드·계좌로 결제
//   예약 작업 열쇠(press_cron_secret)로 확인하고, 결제 기록은 PAYMENT_DB_SECRET 으로만 남긴다. 청구서마다 하루 한 번만 시도
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret: cronSecret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!billingReady()) return NextResponse.json({ ok: true, skipped: 'billing off' })

  const secret = paymentDbSecret()
  const { data: due, error } = await supabase.rpc('autopay_due', { secret })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { invoice: string; ok: boolean; message?: string }[] = []
  // 한 번에 하나씩 (결제사 응답이 늦을 수 있다)
  for (const d of (due ?? []) as { invoice_id: string; outlet_id: string; customer_key: string; billing_key: string; amount: number; manager_email: string | null }[]) {
    const { data: order, error: oErr } = await supabase.rpc('autopay_start', { secret, inv: d.invoice_id })
    if (oErr || !order) { results.push({ invoice: d.invoice_id, ok: false, message: oErr?.message }); continue }
    const o = order as { orderId: string; orderName: string; amount: number }
    try {
      const p = await chargeBilling(d.billing_key, { customerKey: d.customer_key, amount: Number(o.amount), orderId: o.orderId, orderName: o.orderName, customerEmail: d.manager_email })
      await recordPayment(supabase, p)
      if (p.status !== 'DONE') await supabase.rpc('autopay_error', { secret, o: d.outlet_id, msg: `결제 상태: ${p.status}` })
      results.push({ invoice: d.invoice_id, ok: p.status === 'DONE' })
    } catch (e) {
      const msg = e instanceof TossError ? e.message : '결제 서버 오류'
      await recordFailure(supabase, o.orderId, msg)
      await supabase.rpc('autopay_error', { secret, o: d.outlet_id, msg })
      results.push({ invoice: d.invoice_id, ok: false, message: msg })
    }
  }
  return NextResponse.json({ ok: true, charged: results.filter((r) => r.ok).length, results })
}
