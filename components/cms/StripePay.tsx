'use client'

import { useState } from 'react'
import { useT } from './CmsLang'
import { startStripeCheckout, startStripeSetup } from '@/app/(main)/support/payments/actions'

// Stripe 결제 페이지로 보내는 버튼 (금액·주문번호는 서버가 청구서에서 정한다)
export function StripePayButton({ invoiceId, testMode }: { invoiceId: string; testMode: boolean }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError('')
          const r = await startStripeCheckout(invoiceId)
          if (r.ok) { window.location.assign(r.url); return }
          setError(r.error); setBusy(false)
        }}
        className="btn-publish px-5"
      >
        {busy ? t('결제 페이지로 이동 중…', 'Going to the payment page…') : t('결제하기', 'Pay now')}
      </button>
      <p className="text-[12px] text-muted">{t('국내 카드(신한·현대·삼성 등)·카카오페이·네이버페이·구글페이·해외 카드로 결제할 수 있습니다. 5만 원 이상은 카드 할부도 됩니다.', 'You can pay with Korean cards (Shinhan, Hyundai, Samsung, etc.), KakaoPay, Naver Pay, Google Pay, or international cards. Installments are available for card payments of KRW 50,000 or more.')}</p>
      {testMode && <p className="text-[12px] font-semibold text-draft">{t('시험 결제 모드입니다. 실제 돈이 나가지 않고, 청구서도 미납 그대로 남습니다. (시험 카드 4242 4242 4242 4242)', 'Test payment mode. No real money is charged, and the invoice stays unpaid. (Test card 4242 4242 4242 4242)')}</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}

export function StripeSetupButton({ label, consent = false }: { label?: string; consent?: boolean }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy || !consent}
        onClick={async () => {
          setBusy(true); setError('')
          const r = await startStripeSetup(consent)
          if (r.ok) { window.location.assign(r.url); return }
          setError(r.error); setBusy(false)
        }}
        className="btn-secondary bg-white disabled:opacity-50"
      >
        {busy ? t('이동 중…', 'Redirecting…') : (label ?? t('카드·간편결제 등록', 'Register card or mobile pay'))}
      </button>
      {error && <span role="alert" className="text-[12.5px] font-semibold text-danger">{error}</span>}
    </span>
  )
}
