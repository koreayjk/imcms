'use server'

import { paymentDbSecret } from '@/lib/toss'
import { isPayToken, publicDb } from '@/lib/pay-link'
import { siteOrigin, stripe, stripeMessage, stripeReady } from '@/lib/stripe-pay'

// 결제 전용 링크에서 결제 시작 (로그인 없음): 금액·주문은 DB가 청구서에서 정한다. Stripe 결제 페이지로 보낸다
export async function startPayLinkCheckout(token: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayToken(token)) return { ok: false, error: '결제 링크가 올바르지 않습니다.' }
  if (!stripeReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { data, error } = await publicDb().rpc('payment_start_by_token', { secret: paymentDbSecret(), p_token: token, p_kind: 'card', p_provider: 'stripe' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const o = data as { orderId: string; orderName: string; amount: number; invoiceId: string }
  const { data: inv } = await publicDb().rpc('invoice_by_pay_token', { secret: paymentDbSecret(), p_token: token })
  const origin = await siteOrigin()
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ko',
      client_reference_id: o.orderId,
      customer_email: (inv as { manager_email?: string | null } | null)?.manager_email ?? undefined,
      line_items: [{ quantity: 1, price_data: { currency: 'krw', unit_amount: Number(o.amount), product_data: { name: o.orderName } } }],
      metadata: { order_id: o.orderId, invoice_id: o.invoiceId },
      payment_intent_data: { description: o.orderName, metadata: { order_id: o.orderId, invoice_id: o.invoiceId } },
      success_url: `${origin}/pay/${token}/done?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pay/${token}?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    }, { idempotencyKey: `checkout-${o.orderId}` })
    if (!session.url) return { ok: false, error: '결제 페이지를 만들지 못했습니다.' }
    return { ok: true, url: session.url }
  } catch (e) {
    return { ok: false, error: stripeMessage(e) }
  }
}
