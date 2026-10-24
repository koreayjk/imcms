import type { Metadata } from 'next'
import Link from 'next/link'
import { ISSUER, PRODUCT } from '@/lib/product'
import { PLANS, won, type Billing } from '@/lib/pricing'
import { buildQuote, QUOTE_VALID_DAYS } from '@/lib/quote'
import { TAX_NOTE } from '@/lib/support'
import PrintButton from '@/components/cms/PrintButton'

export const metadata: Metadata = { title: `이용료 견적서 — ${PRODUCT.name}`, robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const kstDate = (d: Date) => d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })

// IM 뉴스룸 이용료 견적서: ?plan=standard&billing=annual&to=언론사이름  (인쇄 창에서 PDF로 저장)
export default async function QuotePage(props: { searchParams: Promise<{ plan?: string; billing?: string; to?: string }> }) {
  const sp = await props.searchParams
  const billing: Billing = sp.billing === 'monthly' ? 'monthly' : 'annual'
  const q = buildQuote(sp.plan ?? 'standard', billing)
  const to = (sp.to ?? '').trim().slice(0, 80)
  const today = new Date()
  const until = new Date(today.getTime() + QUOTE_VALID_DAYS * 864e5)
  const no = `Q-${today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(/-/g, '')}-${(sp.plan ?? 'x').slice(0, 2).toUpperCase()}${billing === 'annual' ? 'Y' : 'M'}`
  const row = (k: string, v: string | null | undefined) => (
    <div className="flex gap-3"><dt className="w-32 shrink-0 text-[#6B7280]">{k}</dt><dd>{v || '-'}</dd></div>
  )

  return (
    <div className="min-h-screen bg-[#F4F5F7] px-4 py-8 text-[#14171C] print:bg-white print:p-0">
      <div className="mx-auto max-w-[820px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href={PRODUCT.path} className="text-[13px] text-[#6B7280] hover:text-[#14171C]">← {PRODUCT.name}</Link>
          <form className="flex flex-wrap items-center gap-2 text-[13px]">
            <select name="plan" defaultValue={q?.plan.id ?? 'standard'} className="rounded border border-[#D5D8DD] bg-white px-2 py-1.5">
              {PLANS.filter((p) => p.monthly != null).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select name="billing" defaultValue={billing} className="rounded border border-[#D5D8DD] bg-white px-2 py-1.5">
              <option value="annual">1년 결제</option><option value="monthly">월 결제</option>
            </select>
            <input name="to" defaultValue={to} placeholder="받는 곳 (언론사 이름)" maxLength={80} className="w-44 rounded border border-[#D5D8DD] bg-white px-2 py-1.5" />
            <button className="rounded bg-[#1D3461] px-3 py-1.5 font-semibold text-white">다시 계산</button>
            <PrintButton />
          </form>
        </div>

        <article className="rounded-2xl bg-white p-8 ring-1 ring-black/5 sm:p-10 print:rounded-none print:p-0 print:ring-0">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-[#14171C] pb-5">
            <div>
              <p className="text-[13px] font-bold text-[#6B7280]">{PRODUCT.name}</p>
              <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">견적서</h1>
              <p className="mt-1.5 text-[12.5px] text-[#6B7280] tabular-nums">견적 번호 {no} · 견적일 {kstDate(today)} · 유효기간 {kstDate(until)}까지</p>
            </div>
            {to && <p className="text-[18px] font-bold">{to} 귀하</p>}
          </header>

          {!q ? (
            <p className="mt-8 text-[15px]">엔터프라이즈 요금제는 상담 후 맞춤 견적을 드립니다. {ISSUER.contact} 로 문의해 주세요.</p>
          ) : (
            <>
              <div className="mt-6 grid gap-6 text-[13.5px] sm:grid-cols-2">
                <section>
                  <h2 className="mb-2 text-[13px] font-bold">견적 내용</h2>
                  <dl className="space-y-1">
                    {row('요금제', q.plan.name)}
                    {row('결제 방식', q.billingLabel)}
                    {row('기본 제공', q.plan.specs.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · '))}
                    {row('기자 계정', '무제한')}
                  </dl>
                </section>
                <section>
                  <h2 className="mb-2 text-[13px] font-bold">공급자</h2>
                  <dl className="space-y-1">
                    {row('상호', ISSUER.company)}
                    {ISSUER.bizNo && row(ISSUER.bizNoLabel, ISSUER.bizNo)}
                    {row('대표자', ISSUER.ceo)}
                    {row('주소', ISSUER.address)}
                    {row('연락처', ISSUER.contact)}
                  </dl>
                </section>
              </div>

              <div className="overflow-x-auto">
                <table className="mt-8 w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="border-y border-[#14171C]/80 bg-[#F8F9FA] text-left text-[12.5px]">
                      <th className="px-3 py-2.5 font-semibold">항목</th><th className="w-32 px-3 py-2.5 text-right font-semibold">정상가</th><th className="w-32 px-3 py-2.5 text-right font-semibold">견적 금액</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {q.lines.map((l) => (
                      <tr key={l.name} className="border-b border-[#E4E6EA] align-top">
                        <td className="px-3 py-3">{l.name}{l.note && <span className="mt-0.5 block text-[12.5px] text-[#C2410C]">{l.note}</span>}</td>
                        <td className={`px-3 py-3 text-right ${l.price < l.regular ? 'text-[#9CA3AF] line-through' : ''}`}>{won(l.regular)}</td>
                        <td className="px-3 py-3 text-right font-semibold">{won(l.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <dl className="ml-auto mt-5 w-full max-w-xs space-y-1.5 text-[14px] tabular-nums">
                <div className="flex justify-between border-t-2 border-[#14171C] pt-2 text-[20px] font-extrabold"><dt>첫 결제 금액</dt><dd>{won(q.total)}</dd></div>
                <p className="text-right text-[12px] text-[#6B7280]">{TAX_NOTE}</p>
                <div className="flex justify-between pt-2 text-[13px] text-[#3B4048]"><dt>{q.after.label}</dt><dd>{won(q.after.amount)}</dd></div>
              </dl>

              <ul className="mt-8 list-disc space-y-1 rounded-xl bg-[#F8F9FA] py-4 pl-9 pr-5 text-[13px] leading-relaxed text-[#3B4048]">
                <li>세팅비에는 편집국·홈페이지 개설, 로고·색 맞춤, 법정 표기·정책 페이지, 도메인 연결, 기존 기사·사진 옮기기와 옛 주소 연결, 네이버·구글 검색 등록 대행, 사용법 안내(고객센터 이용안내·작성 가이드)가 들어 있습니다.</li>
                <li>표시된 금액이 최종 금액입니다. 미국 법인 공급이라 한국 부가가치세가 붙지 않으며 세금계산서 대신 청구서와 결제 영수증을 드립니다. <Link href={`${PRODUCT.path}/tax`} className="underline">비용 처리 안내</Link></li>
                <li>AI 사용이 한도를 넘거나 매체를 추가하면 요금표에 따라 추가 요금이 생길 수 있습니다.</li>
                <li>이 견적은 {kstDate(until)}까지 유효하며, 계약 조건은 <a href={`${PRODUCT.url}${PRODUCT.path}/terms`} className="underline">서비스 이용약관</a>을 따릅니다. 첫 청구서는 정식 오픈 전에 발행하며 납부를 확인한 뒤 오픈합니다. 정식 오픈일이 그달 1일이 아니면 그달의 남은 기간은 이용료가 없고, 첫 청구서는 다음 달 이용료입니다. 이후 매월 1일 청구합니다.</li>
              </ul>
            </>
          )}
        </article>
      </div>
    </div>
  )
}
