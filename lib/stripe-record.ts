import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { recordResult } from './payments'
import { methodLabel, stripe, stripeTestMode } from './stripe-pay'

// Stripe 결제(PaymentIntent)를 다시 조회해 우리 주문과 맞춰 본 뒤 기록한다 (결제 완료 화면·웹훅·자동결제가 같이 쓴다)
export async function recordStripeIntent(supabase: SupabaseClient, intentOrId: string | Stripe.PaymentIntent, expected?: { orderId: string; amount: number }) {
  const pi = typeof intentOrId === 'string'
    ? await stripe().paymentIntents.retrieve(intentOrId, { expand: ['latest_charge'] })
    : intentOrId
  const orderId = pi.metadata?.order_id
  if (!orderId || !/^IM[NA]-/.test(orderId)) return { status: null as string | null, error: '우리 주문이 아닙니다.' }
  if (expected && (expected.orderId !== orderId || expected.amount !== pi.amount)) return { status: null, error: '주문 정보가 맞지 않습니다.' }
  if (pi.currency !== 'krw') return { status: null, error: '결제 통화가 원화가 아닙니다.' }
  const charge = (typeof pi.latest_charge === 'object' ? pi.latest_charge : null) as Stripe.Charge | null
  const refunded = !!charge?.refunded
  const status = refunded ? 'canceled' : pi.status === 'succeeded' ? 'done' : pi.status === 'canceled' || pi.status === 'requires_payment_method' ? 'failed' : null
  if (!status) return { status: pi.status, error: null }
  const { error } = await recordResult(supabase, {
    orderId,
    paymentKey: pi.id,
    amount: pi.amount,
    status,
    method: methodLabel(charge?.payment_method_details),
    approvedAt: charge?.created ? new Date(charge.created * 1000).toISOString() : null,
    receiptUrl: charge?.receipt_url ?? null,
    message: status === 'failed' ? pi.last_payment_error?.message ?? '결제가 완료되지 않았습니다.' : null,
    test: stripeTestMode(),
  })
  return { status, error, charge, pi }
}
