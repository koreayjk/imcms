'use client'

import { useState } from 'react'
import { startPayLinkCheckout } from '@/app/pay/actions'
import { autopayConsentLines } from '@/lib/autopay-consent'
import { useCmsLang, useT } from '@/components/cms/CmsLang'

// 결제 전용 링크 화면의 결제 버튼 (로그인 없이). 금액은 서버가 청구서에서 정한다
//   언어: CmsLangProvider 로 감싼 곳에서는 그 언어, 감싸지 않은 공개 결제 화면(/pay)은 한국어
//   첫 결제는 곧 자동결제 등록이다: 카드가 아직 등록되지 않은 매체는 동의해야 결제할 수 있다
export default function PayLinkButton({ token, testMode, hasAutopay }: { token: string; testMode: boolean; hasAutopay: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [consent, setConsent] = useState(false)
  const t = useT()
  const lang = useCmsLang()
  return (
    <div className="space-y-3">
      {!hasAutopay && (
        <fieldset className="rounded-xl border border-line bg-white p-4 text-[13.5px] leading-relaxed">
          <legend className="px-1 text-[13px] font-bold">{t('자동결제(정기결제) 안내 — 첫 결제 카드가 자동결제로 등록됩니다', 'Autopay (recurring payment) notice — the card used for your first payment is registered for autopay')}</legend>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>{t('이번 결제에 쓰는 카드가 다음 달부터 청구서 자동결제 카드로 저장됩니다.', 'The card you use for this payment will be saved as the autopay card for your invoices from next month.')}</li>
            {autopayConsentLines(lang).map((l) => <li key={l}>{l}</li>)}
          </ul>
          <label className="mt-3 flex items-start gap-2 font-semibold">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{t('위 내용을 확인했으며, 이번 결제 카드의 자동결제 등록에 동의합니다. (필수)', 'I have read the above and agree to register the card used for this payment for autopay. (Required)')}</span>
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
        {busy ? t('결제 페이지로 이동 중…', 'Going to the payment page…') : hasAutopay ? t('카드·간편결제로 결제하기', 'Pay by card or digital wallet') : t('동의하고 결제하기 (자동결제 등록)', 'Agree and pay (register autopay)')}
      </button>
      {lang === 'en'
        ? <p className="text-[12px] text-muted">If you choose <strong>&ldquo;Domestic card&rdquo;</strong> in the payment window, the invoice amount is charged as is. With <strong>&ldquo;Card&rdquo;</strong> (entering a Visa or Mastercard number), your card issuer may add a separate foreign transaction fee (about 1-3%, common on debit cards).</p>
        : <p className="text-[12px] text-muted">결제창에서 <strong>&ldquo;국내 카드&rdquo;</strong>를 고르면 청구 금액 그대로 결제됩니다. <strong>&ldquo;카드&rdquo;</strong>(Visa·Mastercard 번호 입력)는 카드사에 따라 해외결제 수수료(약 1~3%, 체크카드에서 흔함)가 카드사에서 따로 붙을 수 있습니다.</p>}
      <p className="text-[12px] text-muted">{t('국내 카드·카카오페이·네이버페이·구글페이·해외 카드로 결제할 수 있습니다. 카드 정보는 결제사(Stripe)가 직접 받고 IM 뉴스룸은 보관하지 않습니다.', 'You can pay with a Korean domestic card, KakaoPay, Naver Pay, Google Pay or an international card. Card details are received directly by the payment processor (Stripe); IM Newsroom does not store them.')}</p>
      {testMode && <p className="text-[12px] font-semibold text-draft">{t('시험 결제 모드입니다. 실제 돈이 나가지 않고 자동결제도 등록되지 않습니다. (시험 카드 4242 4242 4242 4242)', 'Test payment mode. No real money is charged and autopay is not registered. (Test card 4242 4242 4242 4242)')}</p>}
      {error && <p role="alert" className="text-[13px] font-semibold text-danger">{error}</p>}
    </div>
  )
}
