import type { SupabaseClient } from '@supabase/supabase-js'
import { ourStatus, paymentDbSecret, tossTestMode, type TossPayment } from './toss'
import { notify } from './notify'
import { PRODUCT } from './product'

// 결제사와 상관없이 확인된 결제 결과를 DB에 남긴다 (서버 열쇠로만). 시험 결제는 청구서 상태를 바꾸지 않는다
export type PaymentResult = {
  orderId: string; paymentKey: string | null; amount: number; status: 'done' | 'failed' | 'canceled'
  method?: string | null; approvedAt?: string | null; receiptUrl?: string | null; message?: string | null; test: boolean
}
export async function recordResult(supabase: SupabaseClient, r: PaymentResult) {
  const { data, error } = await supabase.rpc('payment_record', {
    secret: paymentDbSecret(), p_order_id: r.orderId, p_payment_key: r.paymentKey, p_amount: r.amount, p_status: r.status,
    p_method: r.method ?? null, p_approved_at: r.approvedAt ?? null, p_receipt_url: r.receiptUrl ?? null, p_message: r.message ?? null, p_test: r.test,
  })
  if (!error && r.status === 'done' && !r.test) await notifyPaid(supabase, data, { orderId: r.orderId, amount: r.amount, method: r.method ?? null, receiptUrl: r.receiptUrl ?? null })
  return { error: error?.message ?? null }
}

// 결제 완료 확인 메일 (청구서 안내와 같은 사람). 같은 주문은 한 번만 (웹훅·완료 화면이 둘 다 기록해도)
//   금액이 달라 '확인 필요'로 남은 결제나 이미 기록된 결제는 보내지 않는다
async function notifyPaid(supabase: SupabaseClient, rec: unknown, p: { orderId: string; amount: number; method: string | null; receiptUrl: string | null }) {
  const r = rec as { invoiceId?: string; needsReview?: boolean; ignored?: boolean } | null
  if (!r?.invoiceId || r.needsReview || r.ignored) return
  const won = Number(p.amount).toLocaleString('ko-KR')
  await notify(supabase, 'payment_done', r.invoiceId, `paid:${p.orderId}`, () => ({
    subject: `[${PRODUCT.name}] 결제가 완료되었습니다 (${won}원)`,
    title: '결제가 완료되었습니다',
    lines: [
      `결제 금액 ${won}원${p.method ? ` · ${p.method}` : ''} · 주문번호 ${p.orderId}`,
      p.receiptUrl ? `결제 영수증: ${p.receiptUrl}` : '결제 영수증은 편집국 고객센터 → 청구서에서 볼 수 있습니다.',
      '한국 세금계산서 대신 이 청구서와 결제 영수증으로 비용 처리할 수 있습니다.',
    ],
    button: { label: '청구서 보기', url: `${PRODUCT.appUrl}/support/invoices/${r.invoiceId}` },
    footer: `이 메일은 ${PRODUCT.name} 이용료 결제 확인입니다.`,
  }))
}

// 환불 안내 메일
export async function notifyRefund(supabase: SupabaseClient, p: { invoiceId: string; orderId: string; amount: number; full: boolean; reason: string }) {
  const won = Number(p.amount).toLocaleString('ko-KR')
  await notify(supabase, 'payment_refunded', p.invoiceId, `refund:${p.orderId}:${p.amount}:${Date.now()}`, () => ({
    subject: `[${PRODUCT.name}] ${won}원 ${p.full ? '환불' : '부분 환불'}되었습니다`,
    title: `${won}원이 ${p.full ? '환불' : '부분 환불'}되었습니다`,
    lines: [
      `주문번호 ${p.orderId} · 사유: ${p.reason}`,
      '카드 결제는 카드사에 따라 3~7영업일 안에 취소가 반영됩니다.',
      p.full ? '전액 환불되어 청구서는 미납 상태로 돌아갔습니다.' : '남은 금액은 그대로 결제된 상태입니다.',
    ],
    button: { label: '청구서 보기', url: `${PRODUCT.appUrl}/support/invoices/${p.invoiceId}` },
    footer: `이 메일은 ${PRODUCT.name} 이용료 환불 안내입니다.`,
  }))
}

// 토스페이먼츠에서 확인한 결제 결과를 DB에 남긴다 (payments.sql 의 payment_record, 서버 열쇠로만)
//   시험 키로 한 결제는 기록만 남기고 청구서는 미납 그대로 둔다
export async function recordPayment(supabase: SupabaseClient, p: TossPayment, fallbackOrderId?: string, failMessage?: string) {
  const status = ourStatus(p.status) ?? (failMessage ? 'failed' : null)
  if (!status) return { error: null as string | null }
  const { data, error } = await supabase.rpc('payment_record', {
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
  if (!error && status === 'done' && !tossTestMode() && p.status === 'DONE') {
    await notifyPaid(supabase, data, { orderId: p.orderId ?? fallbackOrderId ?? '', amount: p.totalAmount ?? 0, method: p.method ?? null, receiptUrl: p.receipt?.url ?? null })
  }
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
