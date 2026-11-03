import type { Metadata } from 'next'
import Link from 'next/link'
import { ISSUER, PRODUCT, appLink } from '@/lib/product'
import BrandMark from '@/components/BrandMark'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'

// 고객용 안내서: 도메인 구입 방법 (imnewsroom.com/domain)
//   도메인은 고객 명의로 고객이 직접 구입한다(비용·연장도 고객 부담). 저희는 구입 방법을 안내하고, 구입한 뒤 홈페이지에 연결해 드린다
//   업체별 가격·한글 도메인 지원 여부는 바뀔 수 있어 숫자와 단정은 적지 않고, 업체 화면에서 확인할 것을 알려 준다
const UPDATED = '2026년 11월'

export const metadata: Metadata = {
  title: `도메인 구입 안내 | ${PRODUCT.name}`,
  description: 'IM 뉴스룸에 연결할 도메인을 구입하는 순서와 주의할 점입니다. 도메인은 대표님 명의로 직접 구입하고, 연결은 저희가 해 드립니다.',
  robots: { index: false, follow: false },
}

const H2 = 'text-[26px] font-extrabold leading-[1.25] tracking-[-0.04em] [text-wrap:balance] sm:text-[32px]'

const STEPS = [
  { t: '도메인 등록 업체에 가입·로그인', d: '가비아, 후이즈, 호스팅케이알, 카페24 같은 도메인 등록 업체 중 편하신 곳을 고르세요. 이미 쓰는 업체가 있으면 그곳에서 사셔도 됩니다.' },
  { t: '검색창에 원하는 이름 넣어 보기', d: '예) newstoday 또는 뉴스폭탄. 확장자(.com, .co.kr, .kr, .ai.kr 등)별로 “구입 가능”인지 화면에 나옵니다. 이미 다른 사람이 쓰는 이름이면 구입할 수 없습니다.' },
  { t: '확장자별 조건 확인', d: '확장자에 따라 등록 조건(사업자 여부 등)과 가격이 다를 수 있습니다. 업체 화면의 안내를 읽고, 이해가 안 되면 저희에게 화면을 캡처해 보내 주세요.' },
  { t: '소유자(등록자) 정보는 꼭 매체·대표님 명의로', d: '도메인의 주인은 등록자로 적힌 사람입니다. 업체나 대행 담당자의 이름이 아니라 대표님(또는 매체 운영 법인) 이름과 연락처, 대표님이 받으실 수 있는 이메일로 적어야 합니다.' },
  { t: '기간 정하고 결제', d: '보통 1년 단위입니다. 연장 비용은 매년 대표님이 부담합니다.' },
  { t: '자동 연장을 켜고, 만료일 알림 받기', d: '기간이 끝나면 도메인이 멈추고 홈페이지가 열리지 않습니다. 업체 화면에서 “자동 연장”을 켜 두거나 만료 알림 메일이 대표님께 오도록 설정하세요.' },
  { t: '구입이 끝나면 저희에게 알려 주세요', d: '도메인 주소와 구입한 업체 이름만 알려 주시면 됩니다. 업체 아이디·비밀번호는 보내지 마세요.' },
]

const FAQ = [
  { q: '도메인은 누가 사나요?', a: '대표님이 직접, 대표님 명의로 구입합니다. 구입 비용과 매년 연장 비용도 대표님이 부담합니다. 저희는 구입 방법을 안내하고, 구입하신 뒤 홈페이지에 연결하는 작업을 해 드립니다(세팅비에 들어 있습니다).' },
  { q: '구입만 해 두면 홈페이지 주소가 바로 바뀌나요?', a: '아닙니다. 연결은 기사 옮기기·디자인 확인·테스트가 모두 끝난 뒤에 합니다. 지금 다른 프로그램으로 홈페이지를 운영 중이면 그대로 켜 두고, 도메인 설정(DNS)은 바꾸지 마세요. 연결할 때가 되면 바꿀 값과 방법을 안내해 드립니다.' },
  { q: '이미 가지고 있는 도메인은요?', a: '그대로 쓰시면 됩니다. 새로 구입하실 필요는 없고, 연결할 때가 되면 안내해 드립니다.' },
  { q: '한글 도메인(예: 뉴스폭탄.ai.kr)도 되나요?', a: '한글 도메인은 업체와 확장자에 따라 지원 여부가 다릅니다. 업체 검색창에 한글로 넣어 “구입 가능”이 뜨는지 먼저 확인하세요. 한글 주소는 메신저나 일부 환경에서 링크가 이상하게 보일 수 있어서, 영문 주소를 대표 주소로 쓰고 한글 주소는 영문 주소로 자동 이동하게 연결하는 방식을 권합니다. 검색 등록(구글·네이버)은 대표 주소 한 곳으로만 합니다.' },
  { q: '업체가 “대신 사 드릴게요”라고 하는데요?', a: '괜찮지만, 소유자(등록자)가 대표님 명의인지 꼭 확인하세요. 업체 이름으로 등록되면 나중에 해지하거나 업체를 바꿀 때 도메인을 가져오기 어려울 수 있습니다.' },
  { q: '혼자 하기 어려워요.', a: '업체 화면을 캡처해 이메일이나 카카오톡으로 보내 주세요. 보시는 화면에 맞춰 어디를 누르는지 안내해 드립니다.' },
]

export default function DomainGuidePage() {
  const home = PRODUCT.path
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all]">
      <IslandNav
        logo={<span className="flex items-center gap-2"><BrandMark size={34} /><span className="text-[18px] font-extrabold tracking-[-0.02em]">IM 뉴스룸</span></span>}
        items={[{ href: home, label: '소개' }, { href: '#steps', label: '구입 순서' }, { href: '#faq', label: '자주 묻는 질문' }]}
        loginHref={appLink('/login')}
        trialHref={appLink('/trial')}
      />

      <main id="top">
        <section className="relative isolate overflow-hidden pb-14 pt-36 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_80%_10%,rgba(29,52,97,0.12),transparent_70%),linear-gradient(180deg,#F1F4F9_0%,#FFFFFF_85%)]" aria-hidden />
          <div className="mx-auto max-w-[860px] px-4 sm:px-6">
            <p className="inline-flex items-center rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(29,52,97,0.14)]">도메인 구입 안내</p>
            <h1 className="mt-6 text-[34px] font-extrabold leading-[1.15] tracking-[-0.05em] [text-wrap:balance] sm:text-[48px]">
              도메인은 대표님 명의로,<br /><span className="text-[#1D3461]">이렇게 구입하세요.</span>
            </h1>
            <p className="mt-6 max-w-[38em] text-[17px] leading-[1.85] text-[#5B616B]">
              매체 주소(예: www.○○○.co.kr)가 되는 도메인은 대표님이 직접 구입합니다. 구입 방법은 아래 순서대로 따라 하시면 되고, 구입하신 뒤 홈페이지에 연결하는 작업은 {PRODUCT.name}이 해 드립니다.
            </p>
            <p className="mt-6 text-[13px] text-[#8C929B]">최종 업데이트 {UPDATED}</p>
          </div>
        </section>

        {/* 한눈에 */}
        <section className="px-4 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[860px]">
            <div className="pn-core grid gap-6 p-7 sm:grid-cols-3 sm:p-9">
              {[
                { t: '구입', v: '대표님이 직접', d: '소유자는 반드시 대표님(또는 매체 운영 법인) 명의로 등록하세요.' },
                { t: '비용', v: '대표님 부담', d: '구입비와 매년 연장비는 도메인 업체에 대표님이 냅니다. 금액은 업체·확장자마다 다릅니다.' },
                { t: '저희가 하는 일', v: '안내와 연결', d: '구입 방법을 안내하고, 구입하신 뒤 홈페이지에 연결해 보안 접속(https)까지 적용합니다.' },
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

        {/* 순서 */}
        <section id="steps" className="scroll-mt-24">
          <div className="mx-auto max-w-[860px] px-4 pt-20 sm:px-6">
            <Reveal><h2 className={H2}>구입 순서</h2></Reveal>
            <ol className="mt-8 space-y-4">
              {STEPS.map((s, i) => (
                <Reveal key={s.t}>
                  <li className="pn-shell"><div className="pn-core flex gap-4 p-6 sm:p-7">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1D3461] text-[15px] font-extrabold text-white tabular-nums">{i + 1}</span>
                    <div>
                      <p className="text-[18px] font-extrabold tracking-[-0.02em]">{s.t}</p>
                      <p className="mt-1.5 text-[15px] leading-[1.8] text-[#3B4048]">{s.d}</p>
                    </div>
                  </div></li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 주의 */}
        <section className="px-4 pt-14 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[860px]">
            <div className="pn-core p-7 sm:p-9">
              <p className="text-[13px] font-bold tracking-[0.04em] text-[#C2410C]">구입한 뒤 이것만은 지켜 주세요</p>
              <ul className="mt-4 space-y-2.5 text-[15.5px] leading-[1.8] text-[#3B4048]">
                <li className="flex gap-3"><span aria-hidden className="font-bold text-[#16294D]">✓</span>구입만 하시고, 도메인 설정(DNS)은 바꾸지 마세요. 연결할 때가 되면 안내해 드립니다.</li>
                <li className="flex gap-3"><span aria-hidden className="font-bold text-[#16294D]">✓</span>도메인 업체 아이디·비밀번호는 저희에게 보내지 마세요.</li>
                <li className="flex gap-3"><span aria-hidden className="font-bold text-[#16294D]">✓</span>메일을 그 도메인(@내도메인)으로 쓰고 계시면 알려 주세요. 메일 설정은 건드리지 않고 연결합니다.</li>
              </ul>
            </div>
          </Reveal>
        </section>

        {/* 질문 */}
        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-[860px] px-4 pt-20 sm:px-6">
            <Reveal><h2 className={H2}>자주 묻는 질문</h2></Reveal>
            <div className="mt-8 space-y-3">
              {FAQ.map((f) => (
                <Reveal key={f.q}>
                  <details className="pn-shell group">
                    <summary className="pn-core flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0F1115]/[0.06] transition-transform duration-500 group-open:rotate-45" aria-hidden>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-4 w-4"><path d="M8 3v10M3 8h10" /></svg>
                      </span>
                    </summary>
                    <p className="px-7 pb-6 pt-4 text-[15.5px] leading-[1.85] text-[#3B4048]">{f.a}</p>
                  </details>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 pt-20 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[860px]">
            <div className="pn-core flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
              <div>
                <p className="text-[22px] font-extrabold leading-[1.3] tracking-[-0.03em] sm:text-[26px]">막히면 화면을 캡처해 보내 주세요.</p>
                <p className="mt-2 text-[15px] text-[#5B616B]">이메일 {ISSUER.contact} 또는 카카오톡으로 보내 주시면 됩니다.</p>
              </div>
              <Pill href={`${home}#apply`} className="shrink-0">서비스 신청 · 상담</Pill>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#DADFE8] bg-[#F7F8FA] text-[13px] text-[#5B616B]">
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
