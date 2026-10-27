import { formatDateTime } from '@/lib/format'
import { KIND_LABEL, KIND_LABEL_EN, PAY_STATUS, PAY_STATUS_EN } from '@/lib/payments'
import { wonL } from '@/lib/support-i18n'
import { getT } from '@/lib/cms-t'
import { PayButtons } from './TossPay'
import { StripePayButton } from './StripePay'
import RefundButton from './RefundButton'

export type PaymentRow = {
  id: string; status: string; kind: string; amount: number; method: string | null; approved_at: string | null
  receipt_url: string | null; fail_message: string | null; test_mode: boolean; created_at: string
  refunded_amount?: number | null
}

// 청구서 아래: 온라인 결제 버튼과 결제 기록 (인쇄할 때는 숨김)
export default async function InvoicePayments({ invoiceId, unpaid, provider, clientKey, testMode, autopay, payments, isSuper = false }: {
  invoiceId: string; unpaid: boolean; provider: 'stripe' | 'toss' | null; clientKey: string; testMode: boolean
  autopay: { card_company: string | null; card_number: string | null; last_error: string | null } | null
  payments: PaymentRow[] | null; isStaff: boolean; isSuper?: boolean
}) {
  const { t, lang } = await getT()
  const shown = (payments ?? []).filter((p) => p.status !== 'ready' || Date.now() - Date.parse(p.created_at) < 30 * 60_000)
  return (
    <>
    <p className="ios-app-only mt-6 rounded-2xl bg-white p-4 text-[14px] sm:p-6 text-muted ring-1 ring-black/5 print:hidden">{t('이 앱에서는 결제 기능을 제공하지 않습니다.', 'Payments are not available in this app.')}</p>
    <section aria-labelledby="pay-title" className="ios-app-hide mt-6 rounded-2xl bg-white p-4 ring-1 sm:p-6 ring-black/5 print:hidden">
      <h2 id="pay-title" className="text-[16px] font-bold">{t('온라인 결제', 'Pay online')}</h2>
      {unpaid ? (
        provider ? (
          <div className="mt-3 space-y-3">
            {autopay && (
              <p className="rounded-lg bg-published/5 px-4 py-3 text-[13.5px]">
                {t('자동결제 등록됨', 'Autopay registered')} · {autopay.card_company} {autopay.card_number} — {t('납부 기한 오전 10시에 자동으로 결제됩니다. 지금 바로 내셔도 됩니다.', 'It will be charged automatically at 10 a.m. on the due date. You can also pay right now.')}
                {autopay.last_error && <span className="mt-1 block text-danger">{t('지난 자동결제 실패', 'Last autopay failed')}: {autopay.last_error}</span>}
              </p>
            )}
            {provider === 'stripe'
              ? <StripePayButton invoiceId={invoiceId} testMode={testMode} />
              : <PayButtons invoiceId={invoiceId} clientKey={clientKey} testMode={testMode} />}
            <p className="text-[12px] text-muted">{t('결제가 끝나면 이 청구서가 바로 “납부 완료”로 바뀌고 영수증을 볼 수 있습니다.', 'When payment is complete, this invoice immediately changes to “Paid” and you can view the receipt.')}</p>
          </div>
        ) : (
          <p className="mt-2 text-[13.5px] text-muted">{t('온라인 결제는 준비 중입니다. 계좌 입금 안내는 운영팀에 문의해 주세요.', 'Online payment is being prepared. Please contact the IM Newsroom team for bank transfer instructions.')}</p>
        )
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">{t('납부가 끝난 청구서입니다.', 'This invoice has been paid.')}</p>
      )}

      {shown.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line text-[13px]">
          {shown.map((p) => {
            const st = PAY_STATUS[p.status] ?? PAY_STATUS.ready
            const stLabel = lang === 'en' ? (PAY_STATUS_EN[p.status] ?? PAY_STATUS_EN.ready) : st.label
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{stLabel}</span>
                {p.test_mode && <span className="rounded bg-draft/15 px-1.5 py-0.5 text-[11px] font-bold text-draft">{t('시험', 'Test')}</span>}
                <span className="tabular-nums">{wonL(p.amount, lang)}</span>
                {!!p.refunded_amount && <span className="rounded bg-line px-1.5 py-0.5 text-[11.5px] font-semibold tabular-nums text-muted">{p.refunded_amount >= p.amount ? t('전액', 'Full') : `${wonL(p.refunded_amount, lang)}`} {t('환불', 'refund')}</span>}
                <span className="text-muted">{(lang === 'en' ? KIND_LABEL_EN : KIND_LABEL)[p.kind] ?? p.kind}{p.method ? ` · ${p.method}` : ''}</span>
                <span className="tabular-nums text-muted">{formatDateTime(p.approved_at ?? p.created_at, lang)}</span>
                {p.fail_message && <span className="text-danger">{p.fail_message}</span>}
                <span className="ml-auto flex items-center gap-2">
                  {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">{t('영수증', 'Receipt')}</a>}
                  {isSuper && p.status === 'done' && <RefundButton paymentId={p.id} remaining={p.amount - (p.refunded_amount ?? 0)} />}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
    </>
  )
}
