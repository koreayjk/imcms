'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { recordPayment, recordResult } from '@/lib/payments'
import { cancelPayment, paymentDbSecret, TossError, tossReady } from '@/lib/toss'
import { siteOrigin, stripe, stripeMessage, stripeReady, stripeTestMode } from '@/lib/stripe-pay'

export type StartResult =
  | { ok: true; orderId: string; orderName: string; amount: number; customerEmail: string | null; customerName: string | null }
  | { ok: false; error: string }

// 청구서 결제 시작: DB가 청구서 금액으로 주문을 만든다 (화면에서 금액을 바꿀 수 없다)
export async function startInvoicePayment(invoiceId: string, kind: 'card' | 'transfer'): Promise<StartResult> {
  if (!tossReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { supabase, user, profile } = await getCmsContext()
  const { data, error } = await supabase.rpc('payment_start', { inv: invoiceId, p_kind: kind, p_provider: 'toss' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const d = data as { orderId: string; orderName: string; amount: number }
  return { ok: true, ...d, amount: Number(d.amount), customerEmail: user.email ?? null, customerName: (profile?.full_name as string | undefined) ?? null }
}

// 자동결제 등록에 쓰는 이 매체의 고객 키
export async function autopayCustomerKey(): Promise<{ ok: true; customerKey: string; email: string | null; name: string | null } | { ok: false; error: string }> {
  const { supabase, outletId, user, profile } = await getCmsContext()
  if (!outletId) return { ok: false, error: '작업할 매체를 먼저 골라 주세요.' }
  const { data, error } = await supabase.rpc('autopay_customer_key', { o: outletId })
  if (error || !data) return { ok: false, error: error?.message ?? '자동결제를 준비하지 못했습니다.' }
  return { ok: true, customerKey: data as string, email: user.email ?? null, name: (profile?.full_name as string | undefined) ?? null }
}

export async function removeAutopay(): Promise<{ error?: string }> {
  const { supabase, outletId } = await getCmsContext()
  if (!outletId) return { error: '작업할 매체를 먼저 골라 주세요.' }
  const { error } = await supabase.rpc('autopay_remove', { o: outletId })
  if (error) return { error: error.message }
  revalidatePath('/support', 'layout')
  return {}
}

// ───────── Stripe ─────────
// 청구서 결제: Stripe 결제 페이지(한국 카드·카카오페이·네이버페이·구글페이 등, 대시보드에서 켠 것)로 보낸다
export async function startStripeCheckout(invoiceId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!stripeReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { supabase, user } = await getCmsContext()
  const { data, error } = await supabase.rpc('payment_start', { inv: invoiceId, p_kind: 'card', p_provider: 'stripe' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const o = data as { orderId: string; orderName: string; amount: number }
  const origin = (await siteOrigin())
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ko',
      client_reference_id: o.orderId,
      customer_email: user.email ?? undefined,
      line_items: [{ quantity: 1, price_data: { currency: 'krw', unit_amount: Number(o.amount), product_data: { name: o.orderName } } }],
      metadata: { order_id: o.orderId, invoice_id: invoiceId },
      payment_intent_data: { description: o.orderName, metadata: { order_id: o.orderId, invoice_id: invoiceId } },
      success_url: `${origin}/support/payments/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/support/invoices/${invoiceId}?canceled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    }, { idempotencyKey: `checkout-${o.orderId}` })
    if (!session.url) return { ok: false, error: '결제 페이지를 만들지 못했습니다.' }
    return { ok: true, url: session.url }
  } catch (e) {
    return { ok: false, error: stripeMessage(e) }
  }
}

// 자동결제 등록: Stripe 화면에서 카드·간편결제를 저장한다 (돈은 나가지 않는다)
export async function startStripeSetup(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!stripeReady()) return { ok: false, error: '자동결제가 아직 준비되지 않았습니다.' }
  const { supabase, outletId, user, profile, isEditorPlus } = await getCmsContext()
  if (!outletId || !isEditorPlus) return { ok: false, error: '편집장·발행인만 자동결제를 등록할 수 있습니다.' }
  const { data: key, error } = await supabase.rpc('autopay_customer_key', { o: outletId })
  if (error || !key) return { ok: false, error: error?.message ?? '자동결제를 준비하지 못했습니다.' }
  const { data: outlet } = await supabase.from('outlets').select('name').eq('id', outletId).maybeSingle()
  const origin = (await siteOrigin())
  try {
    const customer = await stripe().customers.create({
      email: user.email ?? undefined,
      name: (outlet?.name as string | undefined) ?? (profile?.full_name as string | undefined) ?? undefined,
      metadata: { outlet_id: outletId, im_customer_key: key as string },
    })
    const session = await stripe().checkout.sessions.create({
      mode: 'setup',
      currency: 'krw',
      locale: 'ko',
      customer: customer.id,
      metadata: { outlet_id: outletId, im_customer_key: key as string },
      setup_intent_data: { metadata: { outlet_id: outletId } },
      success_url: `${origin}/support/payments/stripe-setup?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/support/billing`,
    })
    if (!session.url) return { ok: false, error: '등록 화면을 만들지 못했습니다.' }
    return { ok: true, url: session.url }
  } catch (e) {
    return { ok: false, error: stripeMessage(e) }
  }
}

// 결제 취소·환불 (운영팀만, 전액)
export async function refundPayment(paymentId: string, reason: string): Promise<{ error?: string; ok?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '환불은 운영팀만 할 수 있습니다.' }
  const { data } = await supabase.rpc('payment_lookup', { secret: paymentDbSecret(), p_payment_id: paymentId })
  const p = data as { orderId: string; paymentKey: string | null; status: string; amount: number; provider: string } | null
  if (!p?.paymentKey || p.status !== 'done') return { error: '환불할 수 있는 결제가 아닙니다.' }
  if (p.provider === 'stripe') {
    try {
      await stripe().refunds.create({ payment_intent: p.paymentKey, reason: 'requested_by_customer', metadata: { note: reason.slice(0, 200) } }, { idempotencyKey: `refund-${p.orderId}` })
      const { error } = await recordResult(supabase, { orderId: p.orderId, paymentKey: p.paymentKey, amount: Number(p.amount), status: 'canceled', test: stripeTestMode() })
      if (error) return { error: `Stripe 환불은 됐지만 기록하지 못했습니다: ${error}` }
    } catch (e) {
      return { error: `환불하지 못했습니다: ${stripeMessage(e)}` }
    }
    revalidatePath('/support', 'layout')
    return { ok: '환불했습니다.' }
  }
  try {
    const res = await cancelPayment(p.paymentKey, reason.trim() || '고객 요청 환불', `cancel-${p.orderId}`)
    const { error } = await recordPayment(supabase, res)
    if (error) return { error: `토스페이먼츠 환불은 됐지만 기록하지 못했습니다: ${error}` }
  } catch (e) {
    return { error: e instanceof TossError ? `환불하지 못했습니다: ${e.message}` : '환불하지 못했습니다.' }
  }
  revalidatePath('/support', 'layout')
  return { ok: '환불했습니다.' }
}
