import type { Metadata } from 'next'
import Link from 'next/link'
import { ISSUER, PRODUCT, appLink } from '@/lib/product'
import { ONBOARDING_STEPS, stepView, type OnboardingStep } from '@/lib/onboarding-guide'
import BrandMark from '@/components/BrandMark'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'
import PrintButton from '@/components/cms/PrintButton'

// 고객용 안내서: 신청 뒤 개통까지 며칠 안에 무엇이 세팅되는지 (접수 확인 메일·개통 안내 메일에서 링크로 드린다)
//   단계 내용은 lib/onboarding-guide.ts (편집국 "개통 진행 현황"과 같은 목록). 검색에는 나오지 않게 한다(noindex)
const UPDATED = '2026년 10월'

export const metadata: Metadata = {
  title: `개통 일정 안내 | ${PRODUCT.name}`,
  description: '신청부터 정식 오픈까지, 단계마다 저희가 하는 일과 부탁드릴 일을 정리했습니다.',
  robots: { index: false, follow: false },
}

const H2 = 'text-[26px] font-extrabold leading-[1.25] tracking-[-0.04em] [text-wrap:balance] print:text-[18px] sm:text-[32px]'

function StepCard({ s, i, tag }: { s: Pick<OnboardingStep, 'title' | 'days' | 'we' | 'you' | 'result'>; i: number; tag?: string }) {
  return (
    <Reveal>
                  <div className="pn-shell break-inside-avoid"><div className="pn-core p-6 print:p-3 sm:p-8">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[13px] font-bold tabular-nums text-[#8C929B]">{i + 1}단계</span>
                      {tag && <span className="rounded-full bg-[#FFF1E6] px-2.5 py-0.5 text-[12px] font-semibold text-[#B54708]">{tag}</span>}
                      <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-[#1D3461] print:text-[15px] sm:text-[23px]">{s.title}</h2>
                      <span className="rounded-full bg-[#EEF2F8] px-3 py-1 text-[12.5px] font-semibold text-[#1D3461] sm:ml-auto">보통 {s.days}</span>
                    </div>
                    <div className="mt-5 grid gap-5 print:mt-2 print:grid-cols-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[12.5px] font-bold text-[#8C929B]">저희가 합니다</p>
                        <ul className="mt-2 space-y-1.5 text-[15px] leading-[1.75] text-[#3B4048] print:text-[12px] print:leading-[1.5]">
                          {s.we.map((x) => <li key={x} className="flex gap-2.5"><span className="text-[#1D3461]" aria-hidden>●</span>{x}</li>)}
                        </ul>
                      </div>
                      <div>
                        <p className="text-[12.5px] font-bold text-[#8C929B]">대표님께 부탁드립니다</p>
                        <ul className="mt-2 space-y-1.5 text-[15px] leading-[1.75] text-[#3B4048] print:text-[12px] print:leading-[1.5]">
                          {s.you.map((x) => <li key={x} className="flex gap-2.5"><span className="text-[#E8590C]" aria-hidden>●</span>{x}</li>)}
                        </ul>
                      </div>
                    </div>
                    <p className="mt-5 rounded-xl bg-[#F7F8FA] px-4 py-3 text-[14px] leading-[1.75] text-[#3B4048] print:mt-2 print:bg-white print:p-0 print:text-[12px]"><span className="font-bold text-[#0F1115]">끝나면</span> {s.result}</p>
                  </div></div>
                </Reveal>
  )
}

export default function OnboardingGuidePage() {
  const home = PRODUCT.path
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all] print:bg-white">
      <div className="print:hidden">
        <IslandNav
          logo={<span className="flex items-center gap-2"><BrandMark size={34} /><span className="text-[18px] font-extrabold tracking-[-0.02em]">IM 뉴스룸</span></span>}
          items={[{ href: home, label: '소개' }, { href: '#flow', label: '단계별 일정' }, { href: '#help', label: '문의' }, { href: `${home}#pricing`, label: '요금' }]}
          loginHref={appLink('/login')}
          trialHref={appLink('/trial')}
        />
      </div>

      <main id="top">
        <section className="relative isolate overflow-hidden pb-14 pt-36 print:pb-4 print:pt-2 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_80%_10%,rgba(29,52,97,0.12),transparent_70%),linear-gradient(180deg,#F1F4F9_0%,#FFFFFF_85%)] print:hidden" aria-hidden />
          <div className="mx-auto max-w-[860px] px-4 sm:px-6">
            <p className="inline-flex items-center rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(29,52,97,0.14)]">신청해 주신 분께 드리는 안내</p>
            <h1 className="mt-6 text-[34px] font-extrabold leading-[1.15] tracking-[-0.05em] [text-wrap:balance] print:mt-3 print:text-[26px] sm:text-[48px]">
              신청 후 개통까지,<br /><span className="text-[#1D3461]">이렇게 진행됩니다.</span>
            </h1>
            <p className="mt-6 max-w-[38em] text-[17px] leading-[1.85] text-[#5B616B] print:mt-3 print:text-[13px] print:leading-[1.7]">
              {PRODUCT.name}은 신청해 주신 뒤 보통 영업일 기준 1~2주 안에 정식 오픈까지 진행합니다. 단계마다 저희가 하는 일과 부탁드릴 일을 정리했습니다. 진행 상황은 편집국 고객센터의 ‘개통 현황’에서 언제든 보실 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 print:hidden">
              <PrintButton label="⬇ PDF로 저장 · 인쇄" />
              <span className="text-[13px] text-[#8C929B]">최종 업데이트 {UPDATED}</span>
            </div>
          </div>
        </section>

        <section id="flow" className="scroll-mt-24 px-4 pb-16 sm:px-6 print:pb-4">
          <ol className="mx-auto max-w-[860px] space-y-5 print:space-y-2">
            {ONBOARDING_STEPS.map((s, i) => (
              <li key={s.id} className="space-y-5 print:space-y-2">
                <StepCard s={s} i={i} tag={s.alt ? '쓰시던 프로그램이 있는 경우' : undefined} />
                {s.alt && <StepCard s={stepView(s, true)} i={i} tag="새로 시작하시는 경우 (대신)" />}
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-6 max-w-[860px] text-[13.5px] leading-[1.8] text-[#5B616B]">
            일정은 영업일 기준 보통의 목표입니다. 로고·법정 표기 같은 자료를 늦게 주시거나 도메인 설정이 늦어지면 그만큼 개통도 늦어질 수 있고, 기존 기사 이전은 양에 따라 더 걸릴 수 있습니다. 어느 단계든 막히면 바로 알려 주세요.
          </p>
        </section>

        <section id="help" className="px-4 pb-24 sm:px-6 print:hidden">
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
