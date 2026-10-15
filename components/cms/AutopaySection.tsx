'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { removeAutopay } from '@/app/(main)/support/payments/actions'
import { formatDateTime } from '@/lib/format'
import { AutopayRegister } from './TossPay'
import { StripeSetupButton } from './StripePay'
import { AUTOPAY_CONSENT_LINES } from '@/lib/autopay-consent'

type Autopay = { card_company: string | null; card_number: string | null; registered_at: string; last_error: string | null } | null

// 결제 정보 화면: 자동결제 카드·계좌 등록/해지
export default function AutopaySection({ autopay, ready, provider, clientKey, testMode }: { autopay: Autopay; ready: boolean; provider: 'stripe' | 'toss' | null; clientKey: string; testMode: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const [agree, setAgree] = useState(false)

  return (
    <>
    <p className="ios-app-only mt-8 rounded-2xl bg-white p-4 text-[14px] sm:p-6 text-muted ring-1 ring-black/5">이 앱에서는 결제수단 등록과 자동결제 설정을 제공하지 않습니다.</p>
    <section aria-labelledby="autopay-title" className="ios-app-hide mt-8 rounded-2xl bg-white p-4 ring-1 sm:p-6 ring-black/5">
      <h2 id="autopay-title" className="text-[16px] font-bold">자동결제</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        카드나 계좌를 등록해 두면 청구서가 나올 때 납부 기한 오전 10시에 자동으로 결제됩니다. 결제가 실패하면 청구서와 이 화면에 알려 드립니다.
      </p>
      {!ready ? (
        <p className="mt-4 rounded-lg bg-[#F8F9FA] px-4 py-3 text-[13.5px] text-muted">자동결제는 준비 중입니다. 청구서에서 카드·계좌이체로 바로 결제할 수 있습니다.</p>
      ) : autopay ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-published/30 bg-published/5 px-4 py-3">
          <div className="min-w-[12rem] flex-1 text-[14px]">
            <p className="font-semibold">{autopay.card_company} {autopay.card_number}</p>
            <p className="text-[12.5px] text-muted">{formatDateTime(autopay.registered_at)} 등록</p>
            {autopay.last_error && <p className="mt-1 text-[12.5px] font-semibold text-danger">지난 자동결제 실패: {autopay.last_error} — 다른 카드로 다시 등록해 주세요.</p>}
          </div>
          {provider === 'stripe' ? <StripeSetupButton label="다른 결제수단으로 바꾸기" consent={agree} /> : <AutopayRegister clientKey={clientKey} label="다른 카드로 바꾸기" consent={agree} />}
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (window.confirm('자동결제를 해지할까요? 앞으로는 청구서에서 직접 결제해야 합니다.')) start(async () => { const r = await removeAutopay(); setMsg(r.error ?? '해지했습니다.'); router.refresh() }) }}
            className="btn-secondary bg-white text-danger"
          >
            {pending ? '해지 중…' : '해지'}
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-start gap-3">
          {provider === 'stripe' ? (
            <StripeSetupButton consent={agree} />
          ) : (
            <>
              <AutopayRegister clientKey={clientKey} label="카드 등록" consent={agree} />
              <AutopayRegister clientKey={clientKey} label="계좌 등록 (퀵계좌이체)" method="TRANSFER" consent={agree} />
            </>
          )}
        </div>
      )}
      {ready && (
        <div className="mt-4 rounded-lg bg-[#F8F9FA] px-4 py-3 text-[13px]">
          <p className="font-semibold">정기결제(자동결제) 안내</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-muted">{AUTOPAY_CONSENT_LINES.map((l) => <li key={l}>{l}</li>)}</ul>
          <label className="mt-2.5 flex items-start gap-2 font-semibold">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            <span>[필수] 위 정기결제 내용을 확인했고 동의합니다 {autopay ? '(결제수단을 바꿀 때)' : '(등록할 때)'}</span>
          </label>
        </div>
      )}
      {ready && testMode && <p className="mt-3 text-[12px] font-semibold text-draft">시험 모드입니다. 실제 결제는 일어나지 않습니다.{provider === 'stripe' ? ' (시험 카드 4242 4242 4242 4242)' : ' (등록 화면 인증번호 000000)'}</p>}
      {msg && <p role="status" className="mt-2 text-[13px] text-muted">{msg}</p>}
    </section>
    </>
  )
}
