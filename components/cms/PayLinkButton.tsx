'use client'

import { useState } from 'react'
import { startPayLinkCheckout } from '@/app/pay/actions'

// 결제 전용 링크 화면의 결제 버튼 (로그인 없이). 금액은 서버가 청구서에서 정한다
export default function PayLinkButton({ token, testMode }: { token: string; testMode: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true); setError('')
          const r = await startPayLinkCheckout(token)
          if (r.ok) { window.location.assign(r.url); return }
          setError(r.error); setBusy(false)
        }}
        className="btn-publish w-full justify-center px-6 py-3 text-[16px] sm:w-auto"
      >
        {busy ? '결제 페이지로 이동 중…' : '카드·간편결제로 결제하기'}
      </button>
      <p className="text-[12px] text-muted">국내 카드·카카오페이·네이버페이·구글페이·해외 카드로 결제할 수 있습니다. 카드 정보는 결제사(Stripe)가 직접 받고 IM 뉴스룸은 보관하지 않습니다.</p>
      {testMode && <p className="text-[12px] font-semibold text-draft">시험 결제 모드입니다. 실제 돈이 나가지 않습니다. (시험 카드 4242 4242 4242 4242)</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}
