'use client'

import { useState } from 'react'
import { useT } from './CmsLang'
import type { T } from '@/lib/cms-i18n'
import { autopayCustomerKey, startInvoicePayment } from '@/app/(main)/support/payments/actions'

// 토스페이먼츠 결제창 (SDK v2 standard). 결제 금액·주문번호는 서버(DB)가 정한다
type TossPaymentApi = {
  requestPayment: (o: Record<string, unknown>) => Promise<void>
  requestBillingAuth: (o: Record<string, unknown>) => Promise<void>
}
type TossFactory = ((clientKey: string) => { payment: (o: { customerKey: string }) => TossPaymentApi }) & { ANONYMOUS: string }

let loading: Promise<TossFactory> | null = null
function loadToss(t: T): Promise<TossFactory> {
  const w = window as unknown as { TossPayments?: TossFactory }
  if (w.TossPayments) return Promise.resolve(w.TossPayments)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://js.tosspayments.com/v2/standard'
    s.async = true
    s.onload = () => (w.TossPayments ? resolve(w.TossPayments) : reject(new Error(t('결제창을 불러오지 못했습니다.', 'Could not load the payment window.'))))
    s.onerror = () => { loading = null; reject(new Error(t('결제창을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.', 'Could not load the payment window. Please check your internet connection.'))) }
    document.head.appendChild(s)
  })
  return loading
}

// 사용자가 결제창을 닫은 경우는 오류로 보지 않는다
const closedByUser = (e: unknown) => /USER_CANCEL|PAY_PROCESS_CANCELED|취소/.test(String((e as { code?: string })?.code ?? '') + String((e as Error)?.message ?? ''))

export function PayButtons({ invoiceId, clientKey, testMode }: { invoiceId: string; clientKey: string; testMode: boolean }) {
  const t = useT()
  const [busy, setBusy] = useState<'' | 'card' | 'transfer'>('')
  const [error, setError] = useState('')

  async function pay(kind: 'card' | 'transfer') {
    setBusy(kind); setError('')
    try {
      const [Toss, order] = await Promise.all([loadToss(t), startInvoicePayment(invoiceId, kind)])
      if (!order.ok) throw new Error(order.error)
      const payment = Toss(clientKey).payment({ customerKey: Toss.ANONYMOUS })
      await payment.requestPayment({
        method: kind === 'transfer' ? 'TRANSFER' : 'CARD',
        amount: { currency: 'KRW', value: order.amount },
        orderId: order.orderId,
        orderName: order.orderName,
        successUrl: `${window.location.origin}/support/payments/success`,
        failUrl: `${window.location.origin}/support/payments/fail?invoice=${invoiceId}`,
        ...(order.customerEmail ? { customerEmail: order.customerEmail } : {}),
        ...(order.customerName ? { customerName: order.customerName.slice(0, 100) } : {}),
        ...(kind === 'transfer' ? { transfer: { cashReceipt: { type: '미발행' } } } : {}),
      })
    } catch (e) {
      if (!closedByUser(e)) setError(e instanceof Error ? e.message : t('결제를 시작하지 못했습니다.', 'Could not start the payment.'))
    }
    setBusy('')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => pay('card')} className="btn-publish px-5">{busy === 'card' ? t('결제창 여는 중…', 'Opening payment window…') : t('카드·간편결제로 결제', 'Pay by card or mobile pay')}</button>
        <button type="button" disabled={!!busy} onClick={() => pay('transfer')} className="btn-secondary bg-white">{busy === 'transfer' ? t('여는 중…', 'Opening…') : t('계좌이체', 'Bank transfer')}</button>
      </div>
      {testMode && <p className="text-[12px] font-semibold text-draft">{t('시험 결제 모드입니다. 실제 돈이 나가지 않고, 청구서도 미납 그대로 남습니다.', 'Test payment mode. No real money is charged, and the invoice stays unpaid.')}</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}

export function AutopayRegister({ clientKey, label, method = 'CARD', consent = false }: { clientKey: string; label?: string; method?: 'CARD' | 'TRANSFER'; consent?: boolean }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function register() {
    setBusy(true); setError('')
    try {
      const [Toss, key] = await Promise.all([loadToss(t), autopayCustomerKey(consent)])
      if (!key.ok) throw new Error(key.error)
      const payment = Toss(clientKey).payment({ customerKey: key.customerKey })
      await payment.requestBillingAuth({
        method,
        successUrl: `${window.location.origin}/support/payments/billing-success`,
        failUrl: `${window.location.origin}/support/payments/fail?billing=1`,
        ...(key.email ? { customerEmail: key.email } : {}),
        ...(key.name ? { customerName: key.name.slice(0, 100) } : {}),
      })
    } catch (e) {
      if (!closedByUser(e)) setError(e instanceof Error ? e.message : t('등록을 시작하지 못했습니다.', 'Could not start the registration.'))
    }
    setBusy(false)
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" disabled={busy || !consent} onClick={register} className="btn-secondary bg-white disabled:opacity-50">{busy ? t('여는 중…', 'Opening…') : (label ?? t('카드 등록', 'Register card'))}</button>
      {error && <span role="alert" className="text-[12.5px] font-semibold text-danger">{error}</span>}
    </span>
  )
}
