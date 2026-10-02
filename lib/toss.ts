// 토스페이먼츠 서버 API (API 개별 연동 키: test_sk_ / live_sk_)
//   환경 변수: NEXT_PUBLIC_TOSS_CLIENT_KEY(브라우저), TOSS_SECRET_KEY(서버), PAYMENT_DB_SECRET(결제 기록용 DB 열쇠, payments.sql 결과)
//   자동결제는 토스페이먼츠와 별도 계약이 있어야 실제 키로 쓸 수 있다 → TOSS_BILLING=on 일 때만 켠다 (시험 키는 늘 켜짐)
const API = 'https://api.tosspayments.com/v1'

export function tossReady() {
  return !!(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY && process.env.TOSS_SECRET_KEY && process.env.PAYMENT_DB_SECRET)
}
export function tossTestMode() {
  return (process.env.TOSS_SECRET_KEY ?? '').startsWith('test_')
}
export function billingReady() {
  return tossReady() && (tossTestMode() || process.env.TOSS_BILLING === 'on')
}
export const paymentDbSecret = () => process.env.PAYMENT_DB_SECRET ?? ''

export class TossError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

export type TossPayment = {
  paymentKey: string
  orderId: string
  status: 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED'
  method?: string | null
  totalAmount: number
  approvedAt?: string | null
  receipt?: { url?: string | null } | null
  failure?: { code?: string; message?: string } | null
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string, timeoutMs = 30_000): Promise<T> {
  const auth = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`, 'utf8').toString('base64')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new TossError(data.code ?? `HTTP_${res.status}`, data.message ?? '결제 서버 응답을 받지 못했습니다.')
    return data as T
  } catch (e) {
    if (e instanceof TossError) throw e
    throw new TossError('NETWORK', e instanceof Error && e.name === 'AbortError' ? '결제 서버 응답이 늦어 확인하지 못했습니다. 잠시 뒤 청구서에서 결제 상태를 확인해 주세요.' : '결제 서버에 연결하지 못했습니다.')
  } finally {
    clearTimeout(timer)
  }
}

// 결제창에서 돌아온 결제를 승인 (10분 안에). 같은 주문번호로 다시 불러도 같은 결과를 돌려준다
export const confirmPayment = (paymentKey: string, orderId: string, amount: number) =>
  call<TossPayment>('POST', '/payments/confirm', { paymentKey, orderId, amount }, `confirm-${orderId}`)

export const getPayment = (paymentKey: string) => call<TossPayment>('GET', `/payments/${encodeURIComponent(paymentKey)}`)

export const cancelPayment = (paymentKey: string, reason: string, key: string) =>
  call<TossPayment>('POST', `/payments/${encodeURIComponent(paymentKey)}/cancel`, { cancelReason: reason.slice(0, 200) }, key)

export type TossBilling = {
  billingKey: string
  customerKey: string
  method?: string
  cardCompany?: string
  cardNumber?: string
  card?: { issuerCode?: string; number?: string } | null
  transfers?: { bankName?: string; bankAccountNumber?: string }[] | null
}

export const issueBillingKey = (authKey: string, customerKey: string) =>
  call<TossBilling>('POST', '/billing/authorizations/issue', { authKey, customerKey })

// 자동결제 (등록한 카드·계좌로 바로 결제, 승인 단계 없음). 응답이 늦을 수 있어 60초까지 기다린다
export const chargeBilling = (billingKey: string, body: { customerKey: string; amount: number; orderId: string; orderName: string; customerEmail?: string | null }) =>
  call<TossPayment>('POST', `/billing/${encodeURIComponent(billingKey)}`, { ...body, customerEmail: body.customerEmail || undefined }, `bill-${body.orderId}`, 60_000)

// 토스 결제 상태 → 우리 결제 상태
export function ourStatus(s: TossPayment['status']): 'done' | 'failed' | 'canceled' | null {
  if (s === 'DONE') return 'done'
  if (s === 'CANCELED' || s === 'PARTIAL_CANCELED') return 'canceled'
  if (s === 'ABORTED' || s === 'EXPIRED') return 'failed'
  return null
}
