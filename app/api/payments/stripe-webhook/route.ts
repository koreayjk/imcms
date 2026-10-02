import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { stripe, stripeReady } from '@/lib/stripe-pay'
import { recordStripeIntent } from '@/lib/stripe-record'

// Stripe 웹훅 (대시보드 → 개발자 → 웹훅에 https://imcms.vercel.app/api/payments/stripe-webhook 등록)
//   서명(STRIPE_WEBHOOK_SECRET)을 확인한 뒤, 결제를 다시 조회해서 우리 주문과 맞는 것만 기록한다
//   받는 이벤트: checkout.session.completed · checkout.session.async_payment_succeeded · checkout.session.async_payment_failed
//              payment_intent.succeeded · payment_intent.payment_failed · charge.refunded
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeReady() || !whSecret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'not configured' }, { status: 503 })
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get('stripe-signature') ?? '', whSecret)
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }

  let intentId: string | null = null
  const obj = event.data.object as { object?: string; mode?: string; payment_intent?: string | { id: string } | null; id?: string }
  if (obj.object === 'checkout.session' && obj.mode === 'payment') intentId = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id ?? null
  else if (obj.object === 'payment_intent') intentId = obj.id ?? null
  else if (obj.object === 'charge') intentId = typeof obj.payment_intent === 'string' ? obj.payment_intent : obj.payment_intent?.id ?? null
  if (!intentId) return NextResponse.json({ ok: true })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  try {
    await recordStripeIntent(supabase, intentId)
  } catch {
    // 조회 실패면 500 을 돌려 Stripe 가 다시 보내게 한다
    return NextResponse.json({ error: 'retry' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
