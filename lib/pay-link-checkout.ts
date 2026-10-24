import { paymentDbSecret } from './toss'
import { isPayToken, publicDb } from './pay-link'
import { siteOrigin, stripe, stripeMessage, stripeReady } from './stripe-pay'

// 결제 전용 링크의 Stripe 결제창 만들기 (로그인 없음). 금액·주문은 DB가 청구서에서 정한다
//   카드가 아직 등록되지 않은 매체는 이 결제의 카드를 다음 달부터 자동결제로 저장한다 (Stripe 결제 버튼 바로 위에 안내 문구가 나온다).
//   동의 기록은 결제가 끝나 카드를 저장할 때 남긴다 (메일 보안 검사가 링크를 미리 열어 봐도 동의가 기록되지 않도록)
//   Stripe 고객은 결제가 끝날 때 만들어진다 (customer_creation)
export async function createPayLinkCheckout(token: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayToken(token)) return { ok: false, error: '결제 링크가 올바르지 않습니다.' }
  if (!stripeReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const db = publicDb()
  const secret = paymentDbSecret()
  const { data: pre } = await db.rpc('invoice_by_pay_token', { secret, p_token: token })
  const inv = pre as { has_autopay?: boolean; manager_email?: string | null; status?: string } | null
  if (!inv) return { ok: false, error: '결제 링크가 올바르지 않습니다.' }
  if (inv.status === 'paid') return { ok: false, error: '이미 납부한 청구서입니다.' }
  const saveCard = !inv.has_autopay
  let autoMeta: Record<string, string> = {}
  if (saveCard) {
    const { data: key, error: kErr } = await db.rpc('payment_link_autopay_key', { secret, p_token: token })
    if (kErr || !key) return { ok: false, error: kErr?.message.replace(/^.*?:\s*/, '') || '자동결제를 준비하지 못했습니다.' }
    const k = key as { outlet_id: string; customer_key: string }
    autoMeta = { autopay: '1', outlet_id: k.outlet_id, im_customer_key: k.customer_key }
  }
  const { data, error } = await db.rpc('payment_start_by_token', { secret, p_token: token, p_kind: 'card', p_provider: 'stripe' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const o = data as { orderId: string; orderName: string; amount: number; invoiceId: string }
  const origin = await siteOrigin()
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ko',
      client_reference_id: o.orderId,
      ...(saveCard
        ? {
            customer_creation: 'always' as const,
            custom_text: { submit: { message: '결제하면 이 카드가 IM 뉴스룸 매월 청구서의 자동결제 카드로 저장되는 데 동의한 것으로 봅니다. 매월 청구서 발행 다음 날 이후 납부 기한(1일) 오전 10시에 결제되며, 편집국 고객센터 → 결제 정보에서 언제든 해지할 수 있습니다.' } },
          }
        : {}),
      customer_email: inv.manager_email ?? undefined,
      line_items: [{ quantity: 1, price_data: { currency: 'krw', unit_amount: Number(o.amount), product_data: { name: o.orderName } } }],
      metadata: { order_id: o.orderId, invoice_id: o.invoiceId, ...autoMeta },
      payment_intent_data: { description: o.orderName, metadata: { order_id: o.orderId, invoice_id: o.invoiceId, ...autoMeta }, ...(saveCard ? { setup_future_usage: 'off_session' as const } : {}) },
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
