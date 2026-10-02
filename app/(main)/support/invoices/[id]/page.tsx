import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ISSUER, PRODUCT } from '@/lib/product'
import { monthLabel, won, type InvoiceItem } from '@/lib/support'
import PendingButton from '@/components/cms/PendingButton'
import PrintButton from '@/components/cms/PrintButton'
import { setInvoicePaid } from '../../actions'
import InvoicePayments, { type PaymentRow } from '@/components/cms/InvoicePayments'
import { tossReady, tossTestMode } from '@/lib/toss'

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const { supabase, isSuper, isStaff } = await getCmsContext()
  const { data: inv } = await supabase.from('invoices').select('*, outlet:outlets(name)').eq('id', params.id).maybeSingle()
  if (!inv) notFound()
  // payments.sql 실행 전이면 결제 기록·자동결제 표가 없어 비어 있다
  const [{ data: billing }, { data: payments }, { data: autopay }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', inv.outlet_id).maybeSingle(),
    supabase.from('payments').select('id, status, kind, amount, method, approved_at, receipt_url, fail_message, test_mode, created_at').eq('invoice_id', inv.id).order('created_at', { ascending: false }),
    supabase.from('outlet_autopay').select('card_company, card_number, last_error').eq('outlet_id', inv.outlet_id).eq('active', true).maybeSingle(),
  ])
  const items = (inv.items ?? []) as InvoiceItem[]
  const row = (k: string, v: string | null | undefined) => (
    <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted">{k}</dt><dd>{v || '-'}</dd></div>
  )

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/support/invoices" className="text-[13px] text-muted hover:text-ink">← 청구서 목록</Link>
        <div className="flex gap-2">
          {isSuper && (
            <form action={setInvoicePaid.bind(null, inv.id, inv.status !== 'paid')}>
              <PendingButton pending="…" className="btn-secondary bg-white">{inv.status === 'paid' ? '미납으로 되돌리기' : '납부 완료 처리'}</PendingButton>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      <article className="rounded-2xl bg-white p-10 ring-1 ring-black/5 print:rounded-none print:p-0 print:ring-0">
        <header className="flex items-start justify-between border-b-2 border-ink pb-5">
          <div>
            <p className="text-[13px] font-bold text-muted">{PRODUCT.name}</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{monthLabel(inv.month)} 청구서</h1>
          </div>
          <span className={`rounded px-3 py-1.5 text-[13px] font-bold ${inv.status === 'paid' ? 'bg-published/10 text-published' : 'bg-danger/10 text-danger'}`}>
            {inv.status === 'paid' ? `납부 완료${inv.paid_at ? ` · ${formatDateTime(inv.paid_at)}` : ''}` : '미납'}
          </span>
        </header>

        <div className="mt-6 grid gap-6 text-[13.5px] sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[13px] font-bold">공급받는 자</h2>
            <dl className="space-y-1">
              {row('매체', (inv.outlet as any)?.name)}
              {row('상호', billing?.company_name)}
              {row('사업자번호', billing?.biz_no)}
              {row('대표자', billing?.ceo_name)}
              {row('담당자', [billing?.manager_name, billing?.manager_email].filter(Boolean).join(' · '))}
            </dl>
          </section>
          <section>
            <h2 className="mb-2 text-[13px] font-bold">공급자</h2>
            <dl className="space-y-1">
              {row('상호', ISSUER.company ?? `${PRODUCT.name} (사업자 정보 등록 예정)`)}
              {row('사업자번호', ISSUER.bizNo)}
              {row('대표자', ISSUER.ceo)}
              {row('주소', ISSUER.address)}
              {row('연락처', ISSUER.contact)}
            </dl>
          </section>
        </div>

        <div className="overflow-x-auto">
        <table className="mt-8 w-full min-w-[480px] text-[14px]">
          <thead>
            <tr className="border-y border-ink/80 bg-[#F8F9FA] text-left text-[12.5px]">
              <th className="px-3 py-2.5 font-semibold">항목</th><th className="w-20 px-3 py-2.5 text-right font-semibold">수량</th><th className="w-32 px-3 py-2.5 text-right font-semibold">단가</th><th className="w-36 px-3 py-2.5 text-right font-semibold">금액</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="px-3 py-3">{it.name}</td><td className="px-3 py-3 text-right">{it.qty}</td><td className="px-3 py-3 text-right">{won(it.unit_price)}</td><td className="px-3 py-3 text-right">{won(it.qty * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <dl className="ml-auto mt-5 w-72 space-y-1.5 text-[14px] tabular-nums">
          <div className="flex justify-between"><dt className="text-muted">공급가액</dt><dd>{won(inv.supply_amount)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">부가세</dt><dd>{won(inv.vat)}</dd></div>
          <div className="flex justify-between border-t-2 border-ink pt-2 text-[20px] font-extrabold"><dt>합계</dt><dd>{won(inv.total)}</dd></div>
        </dl>

        {(inv.due_date || inv.memo) && (
          <div className="mt-8 rounded-xl bg-[#F8F9FA] px-5 py-4 text-[13.5px] leading-relaxed">
            {inv.due_date && <p><strong>납부 기한</strong> {inv.due_date}</p>}
            {inv.memo && <p className="mt-1 whitespace-pre-line">{inv.memo}</p>}
          </div>
        )}
      </article>

      <InvoicePayments
        invoiceId={inv.id}
        unpaid={inv.status !== 'paid'}
        ready={tossReady()}
        clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''}
        testMode={tossTestMode()}
        autopay={autopay ?? null}
        payments={(payments ?? []) as PaymentRow[]}
        isStaff={isStaff}
      />
    </div>
  )
}
