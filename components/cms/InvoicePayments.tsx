import { formatDateTime } from '@/lib/format'
import { KIND_LABEL, PAY_STATUS } from '@/lib/payments'
import { won } from '@/lib/support'
import { PayButtons } from './TossPay'
import RefundButton from './RefundButton'

export type PaymentRow = {
  id: string; status: string; kind: string; amount: number; method: string | null; approved_at: string | null
  receipt_url: string | null; fail_message: string | null; test_mode: boolean; created_at: string
}

// 청구서 아래: 온라인 결제 버튼과 결제 기록 (인쇄할 때는 숨김)
export default function InvoicePayments({ invoiceId, unpaid, ready, clientKey, testMode, autopay, payments, isStaff }: {
  invoiceId: string; unpaid: boolean; ready: boolean; clientKey: string; testMode: boolean
  autopay: { card_company: string | null; card_number: string | null; last_error: string | null } | null
  payments: PaymentRow[] | null; isStaff: boolean
}) {
  const shown = (payments ?? []).filter((p) => p.status !== 'ready' || Date.now() - Date.parse(p.created_at) < 30 * 60_000)
  return (
    <section aria-labelledby="pay-title" className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-black/5 print:hidden">
      <h2 id="pay-title" className="text-[16px] font-bold">온라인 결제</h2>
      {unpaid ? (
        ready ? (
          <div className="mt-3 space-y-3">
            {autopay && (
              <p className="rounded-lg bg-published/5 px-4 py-3 text-[13.5px]">
                자동결제 등록됨 · {autopay.card_company} {autopay.card_number} — 납부 기한 오전 10시에 자동으로 결제됩니다. 지금 바로 내셔도 됩니다.
                {autopay.last_error && <span className="mt-1 block text-danger">지난 자동결제 실패: {autopay.last_error}</span>}
              </p>
            )}
            <PayButtons invoiceId={invoiceId} clientKey={clientKey} testMode={testMode} />
            <p className="text-[12px] text-muted">토스페이먼츠 결제창이 열립니다. 결제가 끝나면 이 청구서가 바로 “납부 완료”로 바뀌고 영수증을 볼 수 있습니다.</p>
          </div>
        ) : (
          <p className="mt-2 text-[13.5px] text-muted">온라인 결제는 준비 중입니다. 계좌 입금 안내는 운영팀에 문의해 주세요.</p>
        )
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">납부가 끝난 청구서입니다.</p>
      )}

      {shown.length > 0 && (
        <ul className="mt-5 divide-y divide-line border-t border-line text-[13px]">
          {shown.map((p) => {
            const st = PAY_STATUS[p.status] ?? PAY_STATUS.ready
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${st.cls}`}>{st.label}</span>
                {p.test_mode && <span className="rounded bg-draft/15 px-1.5 py-0.5 text-[11px] font-bold text-draft">시험</span>}
                <span className="tabular-nums">{won(p.amount)}</span>
                <span className="text-muted">{KIND_LABEL[p.kind] ?? p.kind}{p.method ? ` · ${p.method}` : ''}</span>
                <span className="tabular-nums text-muted">{formatDateTime(p.approved_at ?? p.created_at)}</span>
                {p.fail_message && <span className="text-danger">{p.fail_message}</span>}
                <span className="ml-auto flex items-center gap-2">
                  {p.receipt_url && <a href={p.receipt_url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">영수증</a>}
                  {isStaff && p.status === 'done' && <RefundButton paymentId={p.id} amountLabel={won(p.amount)} />}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
