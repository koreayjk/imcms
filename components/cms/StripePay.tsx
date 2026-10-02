'use client'

import { useState } from 'react'
import { startStripeCheckout, startStripeSetup } from '@/app/(main)/support/payments/actions'

// Stripe 결제 페이지로 보내는 버튼 (금액·주문번호는 서버가 청구서에서 정한다)
export function StripePayButton({ invoiceId, testMode }: { invoiceId: string; testMode: boolean }) {
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
        {busy ? '결제 페이지로 이동 중…' : '결제하기'}
      </button>
      <p className="text-[12px] text-muted">국내 카드(신한·현대·삼성 등)·카카오페이·네이버페이·구글페이·해외 카드로 결제할 수 있습니다. 5만 원 이상은 카드 할부도 됩니다.</p>
      {testMode && <p className="text-[12px] font-semibold text-draft">시험 결제 모드입니다. 실제 돈이 나가지 않고, 청구서도 미납 그대로 남습니다. (시험 카드 4242 4242 4242 4242)</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}

export function StripeSetupButton({ label = '카드·간편결제 등록' }: { label?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError('')
          const r = await startStripeSetup()
          if (r.ok) { window.location.assign(r.url); return }
          setError(r.error); setBusy(false)
        }}
        className="btn-secondary bg-white"
      >
        {busy ? '이동 중…' : label}
      </button>
      {error && <span role="alert" className="text-[12.5px] font-semibold text-danger">{error}</span>}
    </span>
  )
}
