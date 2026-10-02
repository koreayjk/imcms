'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { recordPayment } from '@/lib/payments'
import { cancelPayment, paymentDbSecret, TossError, tossReady } from '@/lib/toss'

export type StartResult =
  | { ok: true; orderId: string; orderName: string; amount: number; customerEmail: string | null; customerName: string | null }
  | { ok: false; error: string }

// 청구서 결제 시작: DB가 청구서 금액으로 주문을 만든다 (화면에서 금액을 바꿀 수 없다)
export async function startInvoicePayment(invoiceId: string, kind: 'card' | 'transfer'): Promise<StartResult> {
  if (!tossReady()) return { ok: false, error: '온라인 결제가 아직 준비되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { supabase, user, profile } = await getCmsContext()
  const { data, error } = await supabase.rpc('payment_start', { inv: invoiceId, p_kind: kind })
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

// 결제 취소·환불 (운영팀만, 전액)
export async function refundPayment(paymentId: string, reason: string): Promise<{ error?: string; ok?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '환불은 운영팀만 할 수 있습니다.' }
  const { data } = await supabase.rpc('payment_lookup', { secret: paymentDbSecret(), p_payment_id: paymentId })
  const p = data as { orderId: string; paymentKey: string | null; status: string } | null
  if (!p?.paymentKey || p.status !== 'done') return { error: '환불할 수 있는 결제가 아닙니다.' }
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
