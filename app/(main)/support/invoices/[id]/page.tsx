import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDate, formatDateTime } from '@/lib/format'
import { ISSUER, PRODUCT } from '@/lib/product'
import { TAX_NOTE, monthLabel, won, type InvoiceItem } from '@/lib/support'
import PendingButton from '@/components/cms/PendingButton'
import PrintButton from '@/components/cms/PrintButton'
import { deleteInvoice, setInvoicePaid } from '../../actions'
import ConfirmSubmit from '@/components/cms/ConfirmSubmit'
import InvoicePayments, { type PaymentRow } from '@/components/cms/InvoicePayments'
import { payProvider } from '@/lib/pay-provider'
import { payLinkFor } from '@/lib/pay-link'
import { cmsOrigin } from '@/lib/origin'
import CopyPayLink from '@/components/cms/CopyPayLink'

export default async function InvoicePage(
  props: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }
) {
  const searchParams = await props.searchParams
  const params = await props.params
  const { supabase, isSuper, isStaff } = await getCmsContext()
  const { data: inv } = await supabase.from('invoices').select('*, outlet:outlets(name)').eq('id', params.id).maybeSingle()
  if (!inv) notFound()
  // payments.sql 실행 전이면 결제 기록·자동결제 표가 없어 비어 있다
  const [{ data: billingRow }, { data: payments }, { data: autopay }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', inv.outlet_id).maybeSingle(),
    supabase.from('payments').select('*').eq('invoice_id', inv.id).order('created_at', { ascending: false }),
    supabase.from('outlet_autopay').select('card_company, card_number, last_error').eq('outlet_id', inv.outlet_id).eq('active', true).maybeSingle(),
  ])
  // 자료를 지운(해지) 매체의 청구서: 매체 이름·청구 정보는 청구서에 남겨 둔 값으로 보여 준다
  const billing = billingRow ?? ((inv as { bill_to_snapshot?: typeof billingRow }).bill_to_snapshot ?? null)
  const outletName = (inv.outlet as { name?: string } | null)?.name ?? (inv as { outlet_name?: string | null }).outlet_name ?? null
  const items = (inv.items ?? []) as InvoiceItem[]
  // 운영팀: 로그인 없이 결제하는 전용 링크 (미납일 때)
  const payUrl = isStaff && inv.status !== 'paid' ? await payLinkFor(supabase, inv.id, await cmsOrigin()) : null
  const row = (k: string, v: string | null | undefined) => (
    <div className="flex gap-3"><dt className="w-24 shrink-0 text-muted sm:w-32">{k}</dt><dd className="min-w-0 break-words">{v || '-'}</dd></div>
  )

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/support/invoices" className="text-[13px] text-muted hover:text-ink">← 청구서 목록</Link>
        <div className="flex flex-wrap gap-2">
          {isSuper && inv.status !== 'paid' && (
            <form action={deleteInvoice.bind(null, inv.id)}>
              <ConfirmSubmit message={`${monthLabel(inv.month)} ${(inv.outlet as { name?: string } | null)?.name ?? ''} 청구서를 지울까요?\n지우면 되돌릴 수 없습니다. (시험 결제 기록도 함께 지워집니다)`} className="btn-secondary bg-white text-danger">청구서 지우기</ConfirmSubmit>
            </form>
          )}
          {isSuper && (
            <form action={setInvoicePaid.bind(null, inv.id, inv.status !== 'paid')}>
              <PendingButton pending="…" className="btn-secondary bg-white">{inv.status === 'paid' ? '미납으로 되돌리기' : '납부 완료 처리'}</PendingButton>
            </form>
          )}
          <PrintButton />
        </div>
      </div>

      {searchParams.error && <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger print:hidden">{searchParams.error}</p>}

      <article className="rounded-2xl bg-white p-5 ring-1 sm:p-10 ring-black/5 print:rounded-none print:p-0 print:ring-0">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-ink pb-5">
          <div>
            <p className="text-[13px] font-bold text-muted">{PRODUCT.name}</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">{monthLabel(inv.month)} 청구서</h1>
            <p className="mt-1.5 text-[12.5px] text-muted tabular-nums">
              {inv.invoice_no && <>청구서 번호 {inv.invoice_no} · </>}발행일 {formatDate(inv.created_at)}
            </p>
          </div>
          <span className={`whitespace-nowrap rounded px-3 py-1.5 text-[13px] font-bold ${inv.status === 'paid' ? 'bg-published/10 text-published' : 'bg-danger/10 text-danger'}`}>
            {inv.status === 'paid' ? `납부 완료${inv.paid_at ? ` · ${formatDateTime(inv.paid_at)}` : ''}` : '미납'}
          </span>
        </header>

        <div className="mt-6 grid gap-6 text-[13.5px] sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[13px] font-bold">공급받는 자</h2>
            <dl className="space-y-1">
              {row('매체', outletName)}
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
              {ISSUER.bizNo && row(ISSUER.bizNoLabel, ISSUER.bizNo)}
              {row('대표자', ISSUER.ceo)}
              {row('주소', ISSUER.address)}
              {row('연락처', ISSUER.contact)}
            </dl>
          </section>
        </div>

        <div className="overflow-x-auto">
        <table className="table-cards mt-8 w-full text-[14px] md:min-w-[480px]">
          <thead>
            <tr className="border-y border-ink/80 bg-[#F8F9FA] text-left text-[12.5px]">
              <th className="px-3 py-2.5 font-semibold">항목</th><th className="w-20 px-3 py-2.5 text-right font-semibold">수량</th><th className="w-32 px-3 py-2.5 text-right font-semibold">단가</th><th className="w-36 px-3 py-2.5 text-right font-semibold">금액</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="tc-full px-3 py-3 font-medium md:font-normal">{it.name}</td><td data-label="수량" className="px-3 py-3 text-right">{it.qty}</td><td data-label="단가" className="px-3 py-3 text-right">{won(it.unit_price)}</td><td data-label="금액" className="px-3 py-3 text-right font-semibold md:font-normal">{it.qty * it.unit_price === 0 ? '무료' : won(it.qty * it.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <dl className="ml-auto mt-5 w-full space-y-1.5 sm:w-72 text-[14px] tabular-nums">
          <div className="flex justify-between border-t-2 border-ink pt-2 text-[20px] font-extrabold"><dt>합계</dt><dd>{won(inv.total)}</dd></div>
          <p className="text-right text-[12px] text-muted">{TAX_NOTE}</p>
        </dl>

        {(inv.due_date || inv.memo) && (
          <div className="mt-8 rounded-xl bg-[#F8F9FA] px-5 py-4 text-[13.5px] leading-relaxed">
            {inv.due_date && <p><strong>납부 기한</strong> {inv.due_date}</p>}
            {inv.memo && <p className="mt-1 whitespace-pre-line">{inv.memo}</p>}
          </div>
        )}
      </article>

      {payUrl && (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 print:hidden">
          <h2 className="text-[14px] font-bold">결제 전용 링크 <span className="text-[12px] font-normal text-muted">(운영팀에게만 보입니다)</span></h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">로그인 없이 이 청구서를 보고 카드로 결제하는 주소입니다. 청구서 안내 메일에 이미 들어 있고, 카톡·문자로 따로 보낼 때 복사해 쓰세요. 링크를 아는 사람은 누구나 이 청구서를 결제할 수 있으니 고객 담당자에게만 보내세요.</p>
          <div className="mt-2"><CopyPayLink url={payUrl} /></div>
        </section>
      )}

      <InvoicePayments
        invoiceId={inv.id}
        unpaid={inv.status !== 'paid'}
        provider={payProvider().provider}
        clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''}
        testMode={payProvider().testMode}
        autopay={autopay ?? null}
        payments={(payments ?? []) as PaymentRow[]}
        isStaff={isStaff}
        isSuper={isSuper}
      />
    </div>
  )
}
