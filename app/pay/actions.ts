'use server'

import { paymentDbSecret } from '@/lib/toss'
import { isPayToken, publicDb } from '@/lib/pay-link'
import { siteOrigin, stripe, stripeMessage, stripeReady } from '@/lib/stripe-pay'
import { AUTOPAY_CONSENT_VERSION } from '@/lib/autopay-consent'

// 결제 전용 링크에서 결제 시작 (로그인 없음): 금액·주문은 DB가 청구서에서 정한다. Stripe 결제 페이지로 보낸다
export async function startPayLinkCheckout(token: string, consent = false): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayToken(token)) return { ok: false, error: '결제 링크가 올바르지 않습니다.' }
  if (!stripeReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  // 첫 결제는 곧 자동결제 등록: 이미 카드가 등록된 매체가 아니면 동의해야 결제할 수 있다
  const { data: pre } = await publicDb().rpc('invoice_by_pay_token', { secret: paymentDbSecret(), p_token: token })
  const hasAutopay = !!(pre as { has_autopay?: boolean } | null)?.has_autopay
  if (!hasAutopay && !consent) return { ok: false, error: '자동결제 동의에 체크해 주세요. 이번 결제 카드가 다음 달부터 자동결제로 등록됩니다.' }
  let autoMeta: Record<string, string> = {}
  let customerId: string | undefined
  if (!hasAutopay) {
    const { data: key, error: kErr } = await publicDb().rpc('payment_link_autopay_key', { secret: paymentDbSecret(), p_token: token })
    if (kErr || !key) return { ok: false, error: kErr?.message.replace(/^.*?:\s*/, '') || '자동결제를 준비하지 못했습니다.' }
    const k = key as { outlet_id: string; customer_key: string; manager_email: string | null; outlet_name: string | null }
    try {
      const customer = await stripe().customers.create({ email: k.manager_email ?? undefined, name: k.outlet_name ?? undefined, metadata: { outlet_id: k.outlet_id, im_customer_key: k.customer_key } })
      customerId = customer.id
    } catch (e) {
      return { ok: false, error: stripeMessage(e) }
    }
    autoMeta = { autopay: '1', outlet_id: k.outlet_id, im_customer_key: k.customer_key }
    const { error: cErr } = await publicDb().rpc('payment_link_autopay_consent', { secret: paymentDbSecret(), p_token: token, p_version: AUTOPAY_CONSENT_VERSION })
    if (cErr) return { ok: false, error: cErr.message.replace(/^.*?:\s*/, '') }
  }
  const { data, error } = await publicDb().rpc('payment_start_by_token', { secret: paymentDbSecret(), p_token: token, p_kind: 'card', p_provider: 'stripe' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const o = data as { orderId: string; orderName: string; amount: number; invoiceId: string }
  const origin = await siteOrigin()
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ko',
      client_reference_id: o.orderId,
      ...(customerId ? { customer: customerId } : { customer_email: (pre as { manager_email?: string | null } | null)?.manager_email ?? undefined }),
      ...(customerId ? { custom_text: { submit: { message: '결제하면 이 카드가 IM 뉴스룸 매월 청구서의 자동결제 수단으로 저장됩니다. 편집국 고객센터 → 결제 정보에서 언제든 해지할 수 있습니다.' } } } : {}),
      line_items: [{ quantity: 1, price_data: { currency: 'krw', unit_amount: Number(o.amount), product_data: { name: o.orderName } } }],
      metadata: { order_id: o.orderId, invoice_id: o.invoiceId, ...autoMeta },
      payment_intent_data: { description: o.orderName, metadata: { order_id: o.orderId, invoice_id: o.invoiceId, ...autoMeta }, ...(customerId ? { setup_future_usage: 'off_session' as const } : {}) },
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
