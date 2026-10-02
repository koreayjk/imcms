import type { SupabaseClient } from '@supabase/supabase-js'
import { ourStatus, paymentDbSecret, tossTestMode, type TossPayment } from './toss'

// 결제사와 상관없이 확인된 결제 결과를 DB에 남긴다 (서버 열쇠로만). 시험 결제는 청구서 상태를 바꾸지 않는다
export type PaymentResult = {
  orderId: string; paymentKey: string | null; amount: number; status: 'done' | 'failed' | 'canceled'
  method?: string | null; approvedAt?: string | null; receiptUrl?: string | null; message?: string | null; test: boolean
}
export async function recordResult(supabase: SupabaseClient, r: PaymentResult) {
  const { error } = await supabase.rpc('payment_record', {
    secret: paymentDbSecret(), p_order_id: r.orderId, p_payment_key: r.paymentKey, p_amount: r.amount, p_status: r.status,
    p_method: r.method ?? null, p_approved_at: r.approvedAt ?? null, p_receipt_url: r.receiptUrl ?? null, p_message: r.message ?? null, p_test: r.test,
  })
  return { error: error?.message ?? null }
}

// 토스페이먼츠에서 확인한 결제 결과를 DB에 남긴다 (payments.sql 의 payment_record, 서버 열쇠로만)
//   시험 키로 한 결제는 기록만 남기고 청구서는 미납 그대로 둔다
export async function recordPayment(supabase: SupabaseClient, p: TossPayment, fallbackOrderId?: string, failMessage?: string) {
  const status = ourStatus(p.status) ?? (failMessage ? 'failed' : null)
  if (!status) return { error: null as string | null }
  const { error } = await supabase.rpc('payment_record', {
    secret: paymentDbSecret(),
    p_order_id: p.orderId ?? fallbackOrderId,
    p_payment_key: p.paymentKey ?? null,
    p_amount: p.totalAmount ?? 0,
    p_status: status,
    p_method: p.method ?? null,
    p_approved_at: p.approvedAt ?? null,
    p_receipt_url: p.receipt?.url ?? null,
    p_message: failMessage ?? p.failure?.message ?? null,
    p_test: tossTestMode(),
  })
  return { error: error?.message ?? null }
}

// 실패만 남길 때 (승인 거절 등 토스 결제 정보가 없을 때)
export async function recordFailure(supabase: SupabaseClient, orderId: string, message: string) {
  await supabase.rpc('payment_record', {
    secret: paymentDbSecret(), p_order_id: orderId, p_payment_key: null, p_amount: 0, p_status: 'failed',
    p_method: null, p_approved_at: null, p_receipt_url: null, p_message: message, p_test: tossTestMode(),
  })
}

export const KIND_LABEL: Record<string, string> = { card: '카드·간편결제', transfer: '계좌이체', autopay: '자동결제' }
export const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  ready: { label: '결제 중', cls: 'bg-line text-muted' },
  done: { label: '결제 완료', cls: 'bg-published/10 text-published' },
  failed: { label: '실패', cls: 'bg-danger/10 text-danger' },
  canceled: { label: '취소·환불', cls: 'bg-line text-muted' },
}
