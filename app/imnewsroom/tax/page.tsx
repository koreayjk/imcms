import type { Metadata } from 'next'
import Link from 'next/link'
import { ISSUER, PRODUCT, appLink } from '@/lib/product'
import BrandMark from '@/components/BrandMark'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'
import PrintButton from '@/components/cms/PrintButton'

// 고객용 안내서: 해외 법인(미국) 서비스 이용료의 세무·회계 처리
//   영업 중 "세금계산서 안 되나요?" 질문에 링크나 PDF로 드린다. 검색에는 나오지 않게 한다(noindex)
//   세무 판단은 고객의 세무사 몫이라 단정하지 않고, 확인할 것과 물어볼 질문을 알려 준다
const UPDATED = '2026년 10월'

export const metadata: Metadata = {
  title: `이용료 비용 처리 안내 (해외 법인 공급) | ${PRODUCT.name}`,
  description: '미국 법인이 공급하는 IM 뉴스룸 이용료를 회계·세무에서 어떻게 처리하는지 담당자와 세무사를 위해 정리했습니다.',
  robots: { index: false, follow: false },
}

const H2 = 'text-[26px] font-extrabold leading-[1.25] tracking-[-0.04em] [text-wrap:balance] print:text-[18px] sm:text-[32px]'

const CASES = [
  {
    who: '부가세 과세사업만 하는 일반과세 사업자',
    note: '광고·콘텐츠 제작처럼 모두 부가세 과세 매출인 경우',
    result: '실제 부담이 같습니다',
    body: '한국 업체의 부가세는 세금계산서로 나중에 돌려받으므로 실제 비용이 이용료와 같습니다. 우리는 처음부터 부가세를 붙이지 않아 같은 금액이 됩니다.',
    tone: 'good',
  },
  {
    who: '면세 매출도 있는 겸영 사업자',
    note: '신문 구독료·후원금처럼 부가세 면세 수입이 함께 있는 경우',
    result: '세무사 확인이 필요합니다',
    body: '해외 법인에서 받은 서비스를 면세 사업에 쓴 부분은 부가세를 직접 신고·납부(대리납부)해야 할 수 있습니다. 면세 수입이 있는지는 부가세 신고서의 “면세사업 수입금액”으로 확인할 수 있습니다.',
    tone: 'warn',
  },
  {
    who: '간이과세자·면세사업자',
    note: '',
    result: '부가세가 붙지 않아 유리할 수 있습니다',
    body: '한국 업체의 부가세는 돌려받을 수 없어 비용이 되지만, 우리는 부가세가 없습니다. 면세사업자는 위의 대리납부 확인이 필요합니다.',
    tone: 'plain',
  },
]

export default function TaxGuidePage() {
  const home = PRODUCT.path
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all] print:bg-white">
      <div className="print:hidden">
        <IslandNav
          logo={<span className="flex items-center gap-2"><BrandMark size={34} /><span className="text-[18px] font-extrabold tracking-[-0.02em]">IM 뉴스룸</span></span>}
          items={[{ href: home, label: '소개' }, { href: '#cases', label: '내 경우는' }, { href: '#docs', label: '받는 서류' }, { href: '#questions', label: '세무사에게 물을 것' }, { href: `${home}#pricing`, label: '요금' }]}
          loginHref={appLink('/login')}
          trialHref={appLink('/trial')}
        />
      </div>

      <main id="top">
        <section className="relative isolate overflow-hidden pb-16 pt-36 print:pb-4 print:pt-2 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_80%_10%,rgba(29,52,97,0.12),transparent_70%),linear-gradient(180deg,#F1F4F9_0%,#FFFFFF_85%)] print:hidden" aria-hidden />
          <div className="mx-auto max-w-[860px] px-4 sm:px-6">
            <p className="inline-flex items-center rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(29,52,97,0.14)]">회계·세무 담당자용 안내</p>
            <h1 className="mt-6 text-[34px] font-extrabold leading-[1.15] tracking-[-0.05em] [text-wrap:balance] print:mt-3 print:text-[26px] sm:text-[48px]">
              해외 법인이 공급하는 이용료,<br /><span className="text-[#1D3461]">비용 처리는 이렇게 합니다.</span>
            </h1>
            <p className="mt-6 max-w-[38em] text-[17px] leading-[1.85] text-[#5B616B] print:mt-3 print:text-[13px] print:leading-[1.7]">
              {PRODUCT.name}은 미국 법인이 공급하는 서비스라 한국 부가세와 세금계산서가 없습니다. 대신 청구서와 결제 영수증으로 비용 처리를 하시면 됩니다. 회사마다 사업 형태가 달라서, 확인할 것과 세무사에게 물어볼 질문을 정리했습니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
              <PrintButton label="⬇ PDF로 저장 · 인쇄" />
              <span className="text-[13px] text-[#8C929B]">최종 업데이트 {UPDATED}</span>
            </div>
          </div>
        </section>

        {/* 한눈에 */}
        <section className="px-4 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[860px]">
            <div className="pn-core grid gap-6 p-7 print:grid-cols-3 print:gap-3 print:p-3 sm:grid-cols-3 sm:p-9">
              {[
                { t: '세금계산서', v: '발행하지 않습니다', d: '미국 법인이라 한국 세금계산서를 낼 수 없습니다.' },
                { t: '한국 부가세', v: '붙지 않습니다', d: '표시된 금액이 최종 금액입니다.' },
                { t: '비용 처리 증빙', v: '청구서 + 결제 영수증', d: '계약서(이용약관)와 이용 기간 자료도 함께 보관하세요.' },
              ].map((x) => (
                <div key={x.t}>
                  <p className="text-[12.5px] font-semibold text-[#8C929B]">{x.t}</p>
                  <p className="mt-1.5 text-[19px] font-extrabold tracking-[-0.03em] text-[#1D3461]">{x.v}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B616B]">{x.d}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* 내 경우 */}
        <section id="cases" className="scroll-mt-24">
          <div className="mx-auto max-w-[860px] px-4 py-20 print:py-4 sm:px-6">
            <Reveal>
              <h2 className={H2}>사업 형태에 따라 이렇게 달라집니다</h2>
              <p className="mt-3 text-[16px] leading-[1.8] text-[#5B616B]">아래는 일반적인 구조입니다. 실제 판단은 회사의 세무사가 합니다.</p>
            </Reveal>
            <div className="mt-10 space-y-4 print:mt-3 print:space-y-2">
              {CASES.map((c) => (
                <Reveal key={c.who}>
                  <div className="pn-shell break-inside-avoid"><div className="pn-core p-6 print:p-3 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[19px] font-extrabold tracking-[-0.03em]">{c.who}</h3>
                        {c.note && <p className="mt-1 text-[13.5px] text-[#8C929B]">{c.note}</p>}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${c.tone === 'good' ? 'bg-[#1F9D6B]/12 text-[#157A52]' : c.tone === 'warn' ? 'bg-[#E8590C]/12 text-[#B8470A]' : 'bg-[#0F1115]/[0.06] text-[#3B4048]'}`}>{c.result}</span>
                    </div>
                    <p className="mt-4 text-[15.5px] leading-[1.85] text-[#3B4048] print:mt-1 print:text-[12px] print:leading-[1.6]">{c.body}</p>
                  </div></div>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <div className="pn-shell mt-8 break-inside-avoid"><div className="pn-core p-6 print:p-3 sm:p-8">
                <h3 className="text-[17px] font-extrabold tracking-[-0.02em]">예: 월 150,000원 서비스</h3>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-[14.5px]">
                    <thead>
                      <tr className="border-b border-[#E3E7EE] text-left text-[12.5px] text-[#8C929B]"><th className="py-2 font-medium" /><th className="py-2 font-medium">한국 업체 (부가세 별도)</th><th className="py-2 font-medium">{PRODUCT.name} (부가세 없음)</th></tr>
                    </thead>
                    <tbody className="tabular-nums">
                      <tr className="border-b border-[#EEF0F3]"><td className="py-2.5 text-[#5B616B]">결제 금액</td><td>150,000 + 15,000 = 165,000원</td><td>150,000원</td></tr>
                      <tr className="border-b border-[#EEF0F3]"><td className="py-2.5 text-[#5B616B]">매입세액 공제 (과세사업자)</td><td>15,000원 돌려받음</td><td>해당 없음</td></tr>
                      <tr><td className="py-2.5 font-semibold">실제 부담</td><td className="font-bold">150,000원</td><td className="font-bold text-[#1D3461]">150,000원</td></tr>
                    </tbody>
                  </table>
                </div>
              </div></div>
            </Reveal>
          </div>
        </section>

        {/* 받는 서류 */}
        <section id="docs" className="scroll-mt-24 bg-[#F7F8FA] print:bg-white">
          <div className="mx-auto max-w-[860px] px-4 py-20 print:py-4 sm:px-6">
            <Reveal><h2 className={H2}>받으시는 서류와 보관할 것</h2></Reveal>
            <div className="mt-10 grid gap-5 print:mt-3 print:grid-cols-2 md:grid-cols-2">
              <Reveal>
                <div className="pn-shell h-full break-inside-avoid"><div className="pn-core h-full p-6 print:p-3 sm:p-7">
                  <p className="text-[13px] font-bold tracking-[0.04em] text-[#1D3461]">{PRODUCT.name}이 드리는 것</p>
                  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#3B4048]">
                    {['견적서 (공급자 정보 포함)', '청구서(Invoice): 번호·발행일·내역·금액', '결제 영수증 (카드·간편결제)', '서비스 이용약관(계약 조건)'].map((x) => <li key={x} className="flex gap-3"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>{x}</li>)}
                  </ul>
                  <dl className="mt-5 space-y-1.5 border-t border-[#EEF0F3] pt-4 text-[13.5px] text-[#5B616B]">
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-[#8C929B]">공급자</dt><dd>{ISSUER.company}</dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-[#8C929B]">{ISSUER.bizNoLabel ?? '사업자번호'}</dt><dd className="tabular-nums">{ISSUER.bizNo}</dd></div>
                    <div className="flex gap-3"><dt className="w-24 shrink-0 text-[#8C929B]">문의</dt><dd className="break-all">{ISSUER.contact}</dd></div>
                  </dl>
                </div></div>
              </Reveal>
              <Reveal delay={100}>
                <div className="pn-shell h-full break-inside-avoid"><div className="pn-core h-full p-6 print:p-3 sm:p-7">
                  <p className="text-[13px] font-bold tracking-[0.04em] text-[#5B616B]">회사에서 보관하실 것</p>
                  <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#3B4048]">
                    {['청구서와 결제 영수증 (카드 해외 결제 전표 또는 송금 증빙)', '계약 내용(이용약관, 견적서)', '이용 기간 자료: 1년 결제처럼 기간이 길면 이용 기간에 맞춰 나눠 비용 처리(선급비용)하는 것이 일반적입니다', '업무 관련성: 편집국 운영에 쓰는 서비스임을 설명할 수 있는 자료'].map((x) => <li key={x} className="flex gap-3"><span className="text-[#8C929B]" aria-hidden>•</span>{x}</li>)}
                  </ul>
                </div></div>
              </Reveal>
            </div>
            <Reveal>
              <p className="mt-6 text-[14px] leading-[1.8] text-[#5B616B]">
                {PRODUCT.name}은 웹에서 접속해 이용하는 서비스이며, 소프트웨어를 내려받아 설치하는 방식이 아닙니다. 원천징수와 관련해 추가 서류가 필요하시면 문의해 주세요.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 미리 알려 주세요 + 세무사 질문 */}
        <section id="questions" className="scroll-mt-24">
          <div className="mx-auto max-w-[860px] px-4 py-20 print:py-4 sm:px-6">
            <Reveal><h2 className={H2}>세무사에게 이렇게 물어보세요</h2></Reveal>
            <Reveal>
              <ol className="mt-8 space-y-3 print:mt-3 print:space-y-1.5">
                {[
                  '해외 법인이 공급하는 클라우드 서비스(웹 소프트웨어) 이용료를 어떤 계정과목과 증빙으로 처리하나요?',
                  '우리 회사는 면세 수입(신문 구독료, 후원금 등)이 있어서 부가세 대리납부 대상이 되나요?',
                  '이 이용료는 원천징수 대상(사용료)인가요, 서비스 이용 대가인가요?',
                ].map((q, i) => (
                  <li key={q} className="flex gap-4 rounded-2xl bg-[#F7F8FA] px-5 py-4 text-[15.5px] leading-[1.75] shadow-[inset_0_0_0_1px_rgba(15,17,21,0.05)] break-inside-avoid print:bg-white">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1D3461] text-[13px] font-bold text-white tabular-nums">{i + 1}</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </Reveal>

            <Reveal>
              <div className="pn-shell mt-10 break-inside-avoid"><div className="pn-core p-6 print:p-3 sm:p-8">
                <h3 className="text-[18px] font-extrabold tracking-[-0.02em]">계약 전에 미리 알려 주세요</h3>
                <ul className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[#3B4048]">
                  {[
                    '정부·기관의 지원금이나 보조금으로 결제하실 때: 정산에 세금계산서 같은 증빙을 요구하는 경우가 있습니다. 해당 기관의 증빙 기준을 먼저 확인해 주세요.',
                    '회사 구매 규정상 세금계산서가 꼭 필요한 경우',
                    '거래처 등록에 한국 사업자등록증을 요구하는 경우: 해외 법인이라 한국 사업자등록증은 없고 위 공급자 정보를 드립니다.',
                  ].map((x) => <li key={x} className="flex gap-3"><span className="text-[#E8590C]" aria-hidden>●</span>{x}</li>)}
                </ul>
              </div></div>
            </Reveal>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 print:hidden">
          <Reveal className="pn-shell mx-auto max-w-[860px]">
            <div className="pn-core flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div>
                <p className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.03em] sm:text-[26px]">궁금한 점은 편하게 문의해 주세요.</p>
                <p className="mt-2 text-[15px] text-[#5B616B]">{ISSUER.contact}</p>
              </div>
              <Pill href={`${home}#apply`} className="shrink-0">서비스 신청 · 상담</Pill>
            </div>
          </Reveal>
        </section>

        <p className="mx-auto max-w-[860px] px-4 pb-14 text-[12.5px] leading-[1.8] text-[#8C929B] sm:px-6">
          이 안내는 일반적인 구조를 설명하는 것이며 법률·세무 자문이 아닙니다. 세법과 해석은 바뀔 수 있고 회사마다 상황이 달라서, 실제 처리는 회사의 세무사나 관할 세무서에 확인해 주세요. 최종 업데이트 {UPDATED}.
        </p>
      </main>

      <footer className="border-t border-[#DADFE8] bg-[#F7F8FA] text-[13px] text-[#5B616B] print:hidden">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <Link href={home} className="font-bold text-[#0F1115]">IM 뉴스룸</Link>
          <div className="flex flex-wrap gap-5">
            <Link href={`${home}/terms`} className="hover:text-[#0F1115]">이용약관</Link>
            <Link href={`${home}/privacy`} className="font-semibold hover:text-[#0F1115]">개인정보처리방침</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
