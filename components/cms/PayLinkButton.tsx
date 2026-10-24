'use client'

import { useState } from 'react'
import { startPayLinkCheckout } from '@/app/pay/actions'
import { AUTOPAY_CONSENT_LINES } from '@/lib/autopay-consent'

// 결제 전용 링크 화면의 결제 버튼 (로그인 없이). 금액은 서버가 청구서에서 정한다
//   첫 결제는 곧 자동결제 등록이다: 카드가 아직 등록되지 않은 매체는 동의해야 결제할 수 있다
export default function PayLinkButton({ token, testMode, hasAutopay }: { token: string; testMode: boolean; hasAutopay: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  return (
    <div className="space-y-3">
      {!hasAutopay && (
        <fieldset className="rounded-xl border border-line bg-white p-4 text-[13.5px] leading-relaxed">
          <legend className="px-1 text-[13px] font-bold">자동결제(정기결제) 안내 — 첫 결제 카드가 자동결제로 등록됩니다</legend>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>이번 결제에 쓰는 카드가 다음 달부터 청구서 자동결제 카드로 저장됩니다.</li>
            {AUTOPAY_CONSENT_LINES.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <label className="mt-3 flex items-start gap-2 font-semibold">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>위 내용을 확인했으며, 이번 결제 카드의 자동결제 등록에 동의합니다. (필수)</span>
          </label>
        </fieldset>
      )}
      <button
        type="button"
        disabled={busy || (!hasAutopay && !consent)}
        onClick={async () => {
          setBusy(true); setError('')
          const r = await startPayLinkCheckout(token, consent)
          if (r.ok) { window.location.assign(r.url); return }
          setError(r.error); setBusy(false)
        }}
        className="btn-publish w-full justify-center px-6 py-3 text-[16px] disabled:opacity-50 sm:w-auto"
      >
        {busy ? '결제 페이지로 이동 중…' : hasAutopay ? '카드·간편결제로 결제하기' : '동의하고 결제하기 (자동결제 등록)'}
      </button>
      <p className="text-[12px] text-muted">국내 카드·카카오페이·네이버페이·구글페이·해외 카드로 결제할 수 있습니다. 카드 정보는 결제사(Stripe)가 직접 받고 IM 뉴스룸은 보관하지 않습니다.</p>
      {testMode && <p className="text-[12px] font-semibold text-draft">시험 결제 모드입니다. 실제 돈이 나가지 않고 자동결제도 등록되지 않습니다. (시험 카드 4242 4242 4242 4242)</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}
