import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordFailure, recordPayment } from '@/lib/payments'
import { billingReady, chargeBilling, paymentDbSecret, TossError } from '@/lib/toss'
import { stripe, stripeMessage, stripeReady } from '@/lib/stripe-pay'
import { recordStripeIntent } from '@/lib/stripe-record'

// 매일 오전 10시~10시 45분(한국) 15분마다 Supabase 예약 작업(payments.sql·scale.sql)이 부른다: 납부 기한이 된 미납 청구서를 등록된 결제수단으로 결제
//   예약 작업 열쇠(press_cron_secret)로 확인하고, 결제 기록은 PAYMENT_DB_SECRET 으로만 남긴다. 청구서마다 하루 한 번만 시도
export const maxDuration = 300
export const dynamic = 'force-dynamic'

type Due = { invoice_id: string; outlet_id: string; customer_key: string; billing_key: string; provider: string; amount: number; manager_email: string | null }

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret: cronSecret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!stripeReady() && !billingReady()) return NextResponse.json({ ok: true, skipped: 'payments off' })

  const secret = paymentDbSecret()
  const { data: due, error } = await supabase.rpc('autopay_due', { secret })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: { invoice: string; ok: boolean; message?: string }[] = []
  // 5분 제한 안에 끝나도록 4분이 지나면 새 결제를 시작하지 않는다 (남은 청구서는 15분 뒤 예약 실행이 이어서. 하루 한 번만 시도하는 규칙은 그대로)
  const deadline = Date.now() + 240_000
  let pending = 0
  // 한 번에 하나씩 (결제사 응답이 늦을 수 있다)
  for (const d of (due ?? []) as Due[]) {
    if (Date.now() > deadline) { pending++; continue }
    const provider = d.provider === 'toss' ? 'toss' : 'stripe'
    if ((provider === 'stripe' && !stripeReady()) || (provider === 'toss' && !billingReady())) continue
    const { data: order, error: oErr } = await supabase.rpc('autopay_start', { secret, inv: d.invoice_id, p_provider: provider })
    if (oErr || !order) { results.push({ invoice: d.invoice_id, ok: false, message: oErr?.message }); continue }
    const o = order as { orderId: string; orderName: string; amount: number }
    const fail = async (msg: string) => {
      await recordFailure(supabase, o.orderId, msg)
      await supabase.rpc('autopay_error', { secret, o: d.outlet_id, msg })
      results.push({ invoice: d.invoice_id, ok: false, message: msg })
    }

    if (provider === 'stripe') {
      const [customer, paymentMethod] = d.billing_key.split('|')
      try {
        const pi = await stripe().paymentIntents.create({
          amount: Number(o.amount), currency: 'krw', customer, payment_method: paymentMethod,
          off_session: true, confirm: true, description: o.orderName,
          receipt_email: d.manager_email ?? undefined,
          metadata: { order_id: o.orderId, invoice_id: d.invoice_id },
          expand: ['latest_charge'],
        }, { idempotencyKey: `autopay-${o.orderId}` })
        const r = await recordStripeIntent(supabase, pi)
        if (r.status === 'done') results.push({ invoice: d.invoice_id, ok: true })
        else if (r.status === 'processing') results.push({ invoice: d.invoice_id, ok: true, message: 'processing' })
        else await fail(pi.last_payment_error?.message ?? `결제 상태: ${pi.status}`)
      } catch (e) {
        await fail(stripeMessage(e))
      }
      continue
    }

    try {
      const p = await chargeBilling(d.billing_key, { customerKey: d.customer_key, amount: Number(o.amount), orderId: o.orderId, orderName: o.orderName, customerEmail: d.manager_email })
      await recordPayment(supabase, p)
      if (p.status !== 'DONE') await supabase.rpc('autopay_error', { secret, o: d.outlet_id, msg: `결제 상태: ${p.status}` })
      results.push({ invoice: d.invoice_id, ok: p.status === 'DONE' })
    } catch (e) {
      await fail(e instanceof TossError ? e.message : '결제 서버 오류')
    }
  }
  return NextResponse.json({ ok: true, charged: results.filter((r) => r.ok).length, pending, results })
}
