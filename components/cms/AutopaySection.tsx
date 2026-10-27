'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeAutopay } from '@/app/(main)/support/payments/actions'
import { formatDateTime } from '@/lib/format'
import { AutopayRegister } from './TossPay'
import { StripeSetupButton } from './StripePay'
import { autopayConsentLines } from '@/lib/autopay-consent'
import { useCmsLang, useT } from '@/components/cms/CmsLang'

type Autopay = { card_company: string | null; card_number: string | null; registered_at: string; last_error: string | null } | null

// 결제 정보 화면: 자동결제 카드·계좌 등록/해지
export default function AutopaySection({ autopay, ready, provider, clientKey, testMode }: { autopay: Autopay; ready: boolean; provider: 'stripe' | 'toss' | null; clientKey: string; testMode: boolean }) {
  const router = useRouter()
  const t = useT()
  const lang = useCmsLang()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const [agree, setAgree] = useState(false)

  return (
    <>
    <p className="ios-app-only mt-8 rounded-2xl bg-white p-4 text-[14px] sm:p-6 text-muted ring-1 ring-black/5">{t('이 앱에서는 결제수단 등록과 자동결제 설정을 제공하지 않습니다.', 'Registering a payment method and setting up autopay are not available in this app.')}</p>
    <section aria-labelledby="autopay-title" className="ios-app-hide mt-8 rounded-2xl bg-white p-4 ring-1 sm:p-6 ring-black/5">
      <h2 id="autopay-title" className="text-[16px] font-bold">{t('자동결제', 'Autopay')}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {t('첫 청구서를 결제하면서 자동결제에 동의하면 그 카드가 자동으로 등록되어, 매월 청구서가 나온 뒤 납부 기한(매월 1일) 오전 10시에 자동 결제됩니다. 따로 등록하실 필요는 없고, 이 화면에서는 카드를 바꾸거나 해지할 수 있습니다. 결제가 실패하면 청구서와 이 화면에 알려 드립니다.', 'If you agree to autopay when paying your first invoice, that card is registered automatically and charged at 10 a.m. on the due date (the 1st of each month) after each monthly invoice is issued. You do not need to register separately; on this screen you can change the card or cancel. If a payment fails, we will tell you on the invoice and on this screen.')}
      </p>
      {!ready ? (
        <p className="mt-4 rounded-lg bg-[#F8F9FA] px-4 py-3 text-[13.5px] text-muted">{t('자동결제는 준비 중입니다. 청구서에서 카드·계좌이체로 바로 결제할 수 있습니다.', 'Autopay is being prepared. You can pay directly from the invoice by card or bank transfer.')}</p>
      ) : autopay ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-published/30 bg-published/5 px-4 py-3">
          <div className="min-w-[12rem] flex-1 text-[14px]">
            <p className="font-semibold">{autopay.card_company} {autopay.card_number}</p>
            <p className="text-[12.5px] text-muted">{t(`${formatDateTime(autopay.registered_at)} 등록`, `Registered ${formatDateTime(autopay.registered_at, lang)}`)}</p>
            {autopay.last_error && <p className="mt-1 text-[12.5px] font-semibold text-danger">{t('지난 자동결제 실패', 'Last autopay failed')}: {autopay.last_error} — {t('다른 카드로 다시 등록해 주세요.', 'please register another card.')}</p>}
          </div>
          {provider === 'stripe' ? <StripeSetupButton label={t('다른 결제수단으로 바꾸기', 'Change payment method')} consent={agree} /> : <AutopayRegister clientKey={clientKey} label={t('다른 카드로 바꾸기', 'Change card')} consent={agree} />}
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (window.confirm(t('자동결제를 해지할까요? 앞으로는 청구서에서 직접 결제해야 합니다.', 'Cancel autopay? From now on you will need to pay invoices yourself.'))) start(async () => { const r = await removeAutopay(); setMsg(r.error ?? t('해지했습니다.', 'Autopay canceled.')); router.refresh() }) }}
            className="btn-secondary bg-white text-danger"
          >
            {pending ? t('해지 중…', 'Canceling…') : t('해지', 'Cancel autopay')}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {provider === 'stripe' ? (
            <StripeSetupButton consent={agree} />
          ) : (
            <>
              <AutopayRegister clientKey={clientKey} label={t('카드 등록', 'Register card')} consent={agree} />
              <AutopayRegister clientKey={clientKey} label={t('계좌 등록 (퀵계좌이체)', 'Register bank account (quick transfer)')} method="TRANSFER" consent={agree} />
            </>
          )}
        </div>
      )}
      {ready && (
        <div className="mt-4 rounded-lg bg-[#F8F9FA] px-4 py-3 text-[13px]">
          <p className="font-semibold">{t('정기결제(자동결제) 안내', 'Recurring payment (autopay) notice')}</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-muted">{autopayConsentLines(lang).map((l) => <li key={l}>{l}</li>)}</ul>
          <label className="mt-2.5 flex items-start gap-2 font-semibold">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>{t('[필수] 위 정기결제 내용을 확인했고 동의합니다', '[Required] I have read and agree to the recurring payment terms above')} {autopay ? t('(결제수단을 바꿀 때)', '(when changing payment method)') : t('(등록할 때)', '(when registering)')}</span>
          </label>
        </div>
      )}
      {ready && testMode && <p className="mt-3 text-[12px] font-semibold text-draft">{t('시험 모드입니다. 실제 결제는 일어나지 않습니다.', 'Test mode. No real payments are made.')}{provider === 'stripe' ? t(' (시험 카드 4242 4242 4242 4242)', ' (test card 4242 4242 4242 4242)') : t(' (등록 화면 인증번호 000000)', ' (verification code 000000 on the registration screen)')}</p>}
      {msg && <p role="status" className="mt-2 text-[13px] text-muted">{msg}</p>}
    </section>
    </>
  )
}
