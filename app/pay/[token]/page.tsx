import type { Metadata } from 'next'
import { invoiceByToken } from '@/lib/pay-link'
import { formatDate } from '@/lib/format'
import { ISSUER, PRODUCT } from '@/lib/product'
import { TAX_NOTE, won } from '@/lib/support'
import { stripeReady, stripeTestMode } from '@/lib/stripe-pay'
import PayLinkButton from '@/components/cms/PayLinkButton'

export const dynamic = 'force-dynamic'
// 링크를 아는 사람만 보는 화면: 검색에 나오지 않게, 주소가 다른 곳으로 새지 않게
export const metadata: Metadata = { title: '청구서 결제 — IM 뉴스룸', robots: { index: false, follow: false }, referrer: 'no-referrer' }

export default async function PayLinkPage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ canceled?: string }> }) {
  const { token } = await props.params
  const { canceled } = await props.searchParams
  const inv = await invoiceByToken(token)
  if (!inv) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <h1 className="text-[20px] font-extrabold">결제 링크를 찾지 못했습니다</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">링크가 잘못되었거나 청구서가 바뀌었을 수 있습니다. 청구서 메일의 링크를 다시 눌러 보시고, 계속 안 되면 {ISSUER.contact ?? '운영팀'}으로 알려 주세요.</p>
      </div>
    )
  }
  const paid = inv.status === 'paid'
  const month = `${Number(inv.month.slice(0, 4))}년 ${Number(inv.month.slice(5, 7))}월`
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:py-14">
      <p className="text-[13px] font-bold text-[#1D3461]">{PRODUCT.name} 이용료 청구서</p>
      <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">{inv.outlet_name} · {month}</h1>
      <p className="mt-1 text-[13px] text-muted">{inv.invoice_no && <>청구서 번호 {inv.invoice_no} · </>}발행일 {formatDate(inv.created_at)}{inv.due_date && <> · 납부 기한 {formatDate(inv.due_date)}</>}</p>

      <div className="mt-6 overflow-x-auto rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-7">
        <table className="w-full text-[14px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-[12.5px] text-muted"><th className="py-2 font-medium">항목</th><th className="py-2 text-right font-medium">수량</th><th className="py-2 text-right font-medium">금액</th></tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-line/60"><td className="py-2.5 pr-3">{it.name}</td><td className="py-2.5 text-right">{it.qty}</td><td className="py-2.5 text-right">{won(it.qty * it.unit_price)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-between border-t-2 border-ink pt-3 text-[20px] font-extrabold tabular-nums"><span>합계</span><span>{won(inv.total)}</span></div>
        <p className="mt-1 text-right text-[12px] text-muted">{TAX_NOTE}</p>
        {inv.memo && <p className="mt-4 whitespace-pre-line rounded-xl bg-[#F8F9FA] px-4 py-3 text-[13.5px] leading-relaxed">{inv.memo}</p>}
      </div>

      <div className="mt-6">
        {paid ? (
          <p role="status" className="rounded-2xl bg-published/10 px-5 py-4 text-[15px] font-bold text-published">납부가 완료된 청구서입니다. 감사합니다.{inv.paid_at && <span className="ml-1 text-[13px] font-normal">({formatDate(inv.paid_at)})</span>}</p>
        ) : !stripeReady() ? (
          <p className="rounded-2xl bg-draft/10 px-5 py-4 text-[14px] leading-relaxed">이 링크에서는 아직 온라인 결제를 열 수 없습니다. 편집국에 로그인해 청구서 화면에서 결제하시거나 운영팀에 문의해 주세요.</p>
        ) : (
          <>
            {canceled && <p role="status" className="mb-3 rounded-lg bg-draft/10 px-4 py-2.5 text-[13.5px]">결제를 마치지 않았습니다. 준비되면 아래 버튼으로 다시 결제해 주세요.</p>}
            <PayLinkButton token={token} testMode={stripeTestMode()} hasAutopay={!!inv.has_autopay} />
          </>
        )}
      </div>
      <p className="mt-8 text-[12px] leading-relaxed text-muted">이 주소는 이 청구서 한 건만 볼 수 있는 결제 전용 링크입니다. 다른 사람에게 전달하지 마세요. 공급자 {ISSUER.company ?? PRODUCT.name}{ISSUER.contact && <> · 문의 {ISSUER.contact}</>}</p>
    </div>
  )
}
