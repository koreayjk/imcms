'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { notifyRefund, recordResult } from '@/lib/payments'
import { cancelPayment, paymentDbSecret, TossError, tossReady } from '@/lib/toss'
import { siteOrigin, stripe, stripeMessage, stripeReady, stripeTestMode } from '@/lib/stripe-pay'
import { AUTOPAY_CONSENT_VERSION } from '@/lib/autopay-consent'
import type { SupabaseClient } from '@supabase/supabase-js'

// 정기결제 동의를 남긴다 (billing-safety-2.sql 전이면 조용히 넘어간다). 권한이 없으면 오류
async function recordAutopayConsent(supabase: SupabaseClient, outletId: string, kind: 'autopay' | 'autopay_cancel') {
  const { error } = await supabase.rpc('record_autopay_consent', { o: outletId, p_kind: kind, p_version: AUTOPAY_CONSENT_VERSION })
  if (error && !/record_autopay_consent|function/i.test(error.message)) return error.message
  return null
}

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
export async function autopayCustomerKey(consent = false): Promise<{ ok: true; customerKey: string; email: string | null; name: string | null } | { ok: false; error: string }> {
  const { supabase, outletId, user, profile } = await getCmsContext()
  if (!outletId) return { ok: false, error: '작업할 매체를 먼저 골라 주세요.' }
  if (!consent) return { ok: false, error: '정기결제(자동결제) 내용에 먼저 동의해 주세요.' }
  const cErr = await recordAutopayConsent(supabase, outletId, 'autopay')
  if (cErr) return { ok: false, error: cErr }
  const { data, error } = await supabase.rpc('autopay_customer_key', { o: outletId })
  if (error || !data) return { ok: false, error: error?.message ?? '자동결제를 준비하지 못했습니다.' }
  return { ok: true, customerKey: data as string, email: user.email ?? null, name: (profile?.full_name as string | undefined) ?? null }
}

export async function removeAutopay(): Promise<{ error?: string }> {
  const { supabase, outletId } = await getCmsContext()
  if (!outletId) return { error: '작업할 매체를 먼저 골라 주세요.' }
  const { error } = await supabase.rpc('autopay_remove', { o: outletId })
  if (error) return { error: error.message }
  await recordAutopayConsent(supabase, outletId, 'autopay_cancel')
  revalidatePath('/support', 'layout')
  return {}
}

// ───────── Stripe ─────────
// 청구서 결제: Stripe 결제 페이지(한국 카드·카카오페이·네이버페이·구글페이 등, 대시보드에서 켠 것)로 보낸다
export async function startStripeCheckout(invoiceId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!stripeReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { supabase, user, isStaff } = await getCmsContext()
  const { data, error } = await supabase.rpc('payment_start', { inv: invoiceId, p_kind: 'card', p_provider: 'stripe' })
  if (error || !data) return { ok: false, error: error?.message.replace(/^.*?:\s*/, '') || '결제를 시작하지 못했습니다.' }
  const o = data as { orderId: string; orderName: string; amount: number }
  const origin = (await siteOrigin())
  // 결제창에 미리 적을 이메일: 고객이 직접 누르면 내 이메일, 운영팀이 대신 열 때는 그 매체의 결제 담당자 이메일 (운영팀 이메일이 고객 영수증으로 가지 않게)
  let prefill: string | undefined = user.email ?? undefined
  if (isStaff) {
    const { data: invRow } = await supabase.from('invoices').select('outlet_id').eq('id', invoiceId).maybeSingle()
    const { data: bill } = invRow ? await supabase.from('outlet_billing').select('manager_email').eq('outlet_id', invRow.outlet_id).maybeSingle() : { data: null }
    prefill = (bill as { manager_email?: string | null } | null)?.manager_email?.trim() || undefined
  }
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      locale: 'ko',
      client_reference_id: o.orderId,
      customer_email: prefill,
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
export async function startStripeSetup(consent = false): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!stripeReady()) return { ok: false, error: '자동결제가 아직 준비되지 않았습니다.' }
  const { supabase, outletId, user, profile, isEditorPlus } = await getCmsContext()
  if (!outletId || !isEditorPlus) return { ok: false, error: '편집장·발행인만 자동결제를 등록할 수 있습니다.' }
  if (!consent) return { ok: false, error: '정기결제(자동결제) 내용에 먼저 동의해 주세요.' }
  const cErr = await recordAutopayConsent(supabase, outletId, 'autopay')
  if (cErr) return { ok: false, error: cErr }
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

// 결제 취소·환불 (총관리자만). amount: 돌려줄 금액 (남은 결제 금액 이하, 비우면 남은 금액 전부)
//   결제사에서 환불이 끝난 뒤 DB에 환불 기록을 남긴다 (billing-safety-2.sql). 전액이 되면 청구서는 미납으로 돌아간다
export async function refundPayment(paymentId: string, reason: string, amount?: number): Promise<{ error?: string; ok?: string }> {
  const { supabase, isSuper, user } = await getCmsContext()
  if (!isSuper) return { error: '환불은 총관리자만 할 수 있습니다.' }
  const { data } = await supabase.rpc('payment_lookup', { secret: paymentDbSecret(), p_payment_id: paymentId })
  const p = data as { orderId: string; paymentKey: string | null; status: string; amount: number; provider: string; refunded?: number; invoiceId?: string } | null
  if (!p?.paymentKey || p.status !== 'done') return { error: '환불할 수 있는 결제가 아닙니다.' }
  const left = Number(p.amount) - Number(p.refunded ?? 0)
  const value = amount == null || !Number.isFinite(amount) ? left : Math.round(amount)
  if (value <= 0 || value > left) return { error: `환불 금액은 1원 이상, 남은 ${left.toLocaleString('ko-KR')}원 이하로 적어 주세요.` }
  const note = reason.trim().slice(0, 200) || '고객 요청 환불'
  // 같은 결제·같은 누계·같은 금액이면 같은 요청으로 본다 (두 번 눌러도 한 번만)
  const idem = `refund-${p.orderId}-${Number(p.refunded ?? 0)}-${value}`
  let ref: string | null = null
  try {
    if (p.provider === 'stripe') {
      const r = await stripe().refunds.create({ payment_intent: p.paymentKey, amount: value, reason: 'requested_by_customer', metadata: { note } }, { idempotencyKey: idem })
      ref = r.id
    } else {
      const r = await cancelPayment(p.paymentKey, note, idem, value === left && !p.refunded ? undefined : value)
      ref = r.paymentKey ?? null
    }
  } catch (e) {
    return { error: `환불하지 못했습니다: ${p.provider === 'stripe' ? stripeMessage(e) : e instanceof TossError ? e.message : '결제사 응답 없음'}` }
  }
  const { data: rec, error } = await supabase.rpc('payment_refund_record', { secret: paymentDbSecret(), p_payment_id: paymentId, p_amount: value, p_reason: note, p_user: user.id, p_ref: ref })
  if (error) {
    // billing-safety-2.sql 전이면 예전 방식(전액 취소 기록)으로
    if (/payment_refund_record/.test(error.message) && value === left) {
      await recordResult(supabase, { orderId: p.orderId, paymentKey: p.paymentKey, amount: Number(p.amount), status: 'canceled', test: p.provider === 'stripe' ? stripeTestMode() : false })
    } else {
      return { error: `결제사 환불은 됐지만 기록하지 못했습니다. 운영 기록에 직접 남겨 주세요: ${error.message}` }
    }
  }
  const r = rec as { invoiceId?: string; full?: boolean } | null
  if (r?.invoiceId) await notifyRefund(supabase, { invoiceId: r.invoiceId, orderId: p.orderId, amount: value, full: !!r.full, reason: note })
  revalidatePath('/support', 'layout')
  return { ok: `${value.toLocaleString('ko-KR')}원을 환불했습니다${r?.full ? ' (전액)' : ''}.` }
}
