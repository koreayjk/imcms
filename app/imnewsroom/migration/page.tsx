import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ISSUER, PRODUCT, appLink, isProductHost } from '@/lib/product'
import BrandMark from '@/components/BrandMark'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'

// 타사 이전 안내: ND소프트·미디어온·팡고링고 같은 다른 프로그램에서 옮겨 오려는 신문사가 검색으로 들어오는 길 (imnewsroom.com/migration)
//   절차는 docs/migration-runbook.md 와 같다. 일정·가능 범위는 받은 자료를 확인한 뒤 안내하므로 단정하지 않는다
const CHECKED = '2026년 11월'
const TITLE = '인터넷신문 타사 이전: 쓰던 기사와 주소 그대로 옮기는 방법'
const DESC = 'ND소프트·미디어온·팡고링고 등 다른 프로그램에서 IM 뉴스룸으로 기사·사진·옛 기사 주소를 옮기는 순서, 준비할 자료, 도메인 처리 방법을 정리했습니다. 지금 홈페이지는 전환하는 날까지 그대로 켜 둡니다.'

export async function generateMetadata(): Promise<Metadata> {
  const indexable = PRODUCT.indexable && isProductHost((await headers()).get('host'))
  return {
    title: `${TITLE} | ${PRODUCT.name}`,
    description: DESC,
    openGraph: { title: TITLE, description: DESC, type: 'article', locale: 'ko_KR', images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
    ...(indexable ? { robots: { index: true, follow: true }, alternates: { canonical: `${PRODUCT.url}/migration` } } : { robots: { index: false } }),
  }
}

const STEPS = [
  { n: 1, t: '이전 상담', who: '함께', d: '지금 쓰는 프로그램, 기사와 사진 규모, 도메인을 관리하는 곳, 네이버 뉴스 제휴 여부, 꼭 필요한 기능을 확인합니다. 신청서의 “기존 사이트 이전·연동 확인” 답이 출발점이고, 모르는 항목은 같이 확인합니다.' },
  { n: 2, t: '백업 자료 받기', who: '대표님', d: '지금 쓰는 업체에 기사 전체(제목·본문·작성일·기자·섹션·기사 번호)와 원본 사진 파일을 요청합니다. 요청 문구는 저희가 드리고, 받은 자료는 구글 드라이브 같은 공유 링크로 보내 주세요.' },
  { n: 3, t: '새 홈페이지 준비 (지금 홈페이지는 그대로)', who: '저희', d: '미리보기 주소에서 로고·색·섹션·법정 표기를 꾸미고, 받은 자료로 기사와 사진을 옮깁니다. 옛 기사 번호를 함께 저장해서 옛 주소로 들어와도 새 기사로 넘어가게 합니다. 이 동안 지금 홈페이지는 그대로 켜 둡니다.' },
  { n: 4, t: '확인과 디자인 수정', who: '함께', d: '기사 수, 아무 기사 20건의 제목·본문·사진·기자·날짜, 섹션 순서, 첫 화면, 하단 등록 정보, 광고 위치, 모바일 화면을 확인합니다. 바꾸고 싶은 디자인은 이때 말씀해 주세요. “이대로 전환해도 된다”는 확인을 글로 받습니다.' },
  { n: 5, t: '사용법 안내', who: '저희', d: '고객센터 이용안내 영상과 기사 작성 가이드로 기사 쓰기·승인·발행·홈 편집을 안내하고, 막히면 업무요청이나 카카오톡으로 답해 드립니다.' },
  { n: 6, t: '전환하는 날: 도메인 연결과 검색 등록', who: '함께', d: '새로 쓴 기사만 한 번 더 옮긴 뒤, 도메인 설정(DNS)을 새 홈페이지로 바꿉니다. 열리는 것을 확인하고 옛 기사 주소가 새 기사로 넘어가는지 점검한 다음, 구글·네이버에 사이트맵을 다시 제출합니다. 문제가 생기면 값을 예전으로 되돌려 바로 원래대로 돌아옵니다.' },
]

const PREPARE = [
  '지금 쓰는 프로그램 이름 (ND소프트, 미디어온, 팡고링고 등)',
  '도메인을 관리하는 곳과, 그곳에 로그인해 DNS 설정을 바꿀 수 있는 분',
  '지금 업체에 기사 전체와 원본 사진 백업을 요청 (요청 문구는 저희가 드립니다)',
  '로고 파일(배경 투명 PNG), 대표 색, 메뉴(섹션) 구성',
  '구글 서치콘솔·네이버 서치어드바이저에 로그인할 수 있는지, 네이버 뉴스 제휴 매체인지',
  '도메인 메일(@내도메인)을 쓰는지 (쓰고 있으면 메일 설정은 건드리지 않습니다)',
]

const DOMAIN = [
  { t: '쓰던 도메인은 그대로', d: '이미 가지고 계신 도메인을 그대로 씁니다. 새로 구입하실 필요가 없고, 소유자도 바뀌지 않습니다.' },
  { t: '전환하는 날 한 번만 연결', d: '그 전까지는 지금 홈페이지가 그대로 열립니다. 전환 날에 도메인 설정(DNS) 값만 새 홈페이지로 바꾸고, 필요한 값과 방법은 저희가 안내합니다. 아이디·비밀번호는 보내지 않으셔도 됩니다.' },
  { t: '새 도메인은 직접 구입', d: '도메인이 없거나 새 주소를 쓰고 싶으시면 대표님 명의로 직접 구입하세요. 구입 방법은 도메인 구입 안내에서, 구입하신 뒤 연결은 저희가 합니다.' },
]

const FAQ = [
  { q: '기사와 사진도 모두 옮겨지나요?', a: '지금 업체에서 받은 백업 자료를 기준으로 옮깁니다. 자료 형식에 따라 옮길 수 있는 범위가 달라질 수 있어서, 자료를 받으면 확인한 뒤 가능한 범위와 일정을 안내드립니다. 삭제한 기사는 빼고 옮깁니다.' },
  { q: '옛 기사 주소로 들어오는 독자와 검색은요?', a: '옛 기사 번호를 저장해 두어서 옛 주소(예: …articleView.html?idxno=123)로 들어오면 새 기사로 이동합니다. 전환 날에 모든 번호를 새 사이트에서 점검합니다. 검색 노출이 그대로 유지된다고 약속할 수는 없지만, 끊기지 않도록 연결합니다.' },
  { q: '홈페이지가 멈추는 시간이 있나요?', a: '준비하는 동안은 지금 홈페이지를 그대로 켜 두고, 전환은 방문자가 적은 평일 새벽을 권합니다. 도메인 값을 바꾼 뒤 연결되기까지 몇 분에서 몇 시간 걸릴 수 있습니다.' },
  { q: '옮긴 뒤에 옛 사이트에서 기사를 고치면요?', a: '이미 옮긴 기사를 옛 사이트에서 고쳐도 새 사이트에는 자동으로 바뀌지 않습니다. 고칠 기사는 전환 뒤 새 편집국에서 고치세요. 전환 직전에 새로 쓴 기사는 마지막에 한 번 더 옮깁니다.' },
  { q: '지금 쓰는 기능이 모두 있나요?', a: '독자 회원가입·마이페이지, 포털 FTP 전송, 여러 언어 선택 같은 일부 기능은 없을 수 있습니다. 꼭 필요한 기능이 있으면 신청 전에 알려 주세요.' },
  { q: '네이버 뉴스 제휴 매체인데요.', a: '전송 방식이 바뀌므로 전환 전에 네이버 제휴 담당에 새 전송 주소를 알려야 합니다. 이전 상담 때 제휴 방식을 같이 확인합니다.' },
  { q: '얼마나 걸리나요?', a: '기사 수와 사진 용량에 따라 다릅니다. 자료를 받은 뒤 새 홈페이지 준비와 기사 옮기기에 보통 3~7일, 그다음 확인과 전환 일정은 상담해서 정합니다. 옮기는 기사 수가 많으면 더 걸릴 수 있습니다.' },
  { q: '비용은요?', a: '기존 기사·사진 옮기기는 세팅비에 포함되어 있습니다. 이용료와 세팅비는 요금표를 확인해 주세요.' },
]

const JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
})

const H2 = 'text-[28px] font-extrabold leading-[1.2] tracking-[-0.04em] [text-wrap:balance] sm:text-[38px]'

export default function MigrationPage() {
  const home = PRODUCT.path
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSONLD }} />
      <IslandNav
        logo={<span className="flex items-center gap-2"><BrandMark size={34} /><span className="text-[18px] font-extrabold tracking-[-0.02em]">IM 뉴스룸</span></span>}
        items={[{ href: home, label: '소개' }, { href: '#steps', label: '이전 순서' }, { href: '#domain', label: '도메인' }, { href: '#faq', label: '자주 묻는 질문' }, { href: `${home}#pricing`, label: '요금' }]}
        loginHref={appLink('/login')}
        trialHref={appLink('/trial')}
      />

      <main id="top">
        <section className="relative isolate overflow-hidden pb-20 pt-36 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_80%_10%,rgba(29,52,97,0.12),transparent_70%),radial-gradient(40%_35%_at_6%_80%,rgba(232,89,12,0.06),transparent_70%),linear-gradient(180deg,#F1F4F9_0%,#FFFFFF_85%)]" aria-hidden />
          <div className="mx-auto max-w-[920px] px-4 sm:px-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(29,52,97,0.14)]">타사 이전 안내</p>
            <h1 className="mt-6 text-[38px] font-extrabold leading-[1.1] tracking-[-0.05em] [text-wrap:balance] sm:text-[58px]">
              쓰던 기사와 주소,<br /><span className="text-[#1D3461]">그대로 옮겨 드립니다.</span>
            </h1>
            <p className="mt-6 max-w-[36em] text-[17.5px] leading-[1.8] text-[#5B616B]">
              ND소프트·미디어온·팡고링고 같은 다른 프로그램에서 쓰던 기사와 사진을 옮기고, 옛 기사 주소로 들어오는 독자와 검색엔진도 새 기사로 이어지게 연결합니다. 지금 홈페이지는 전환하는 날까지 그대로 켜 둡니다.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Pill href={`${home}#apply`}>이전 상담 신청</Pill>
              <Pill href="#steps" tone="light">이전 순서 보기</Pill>
            </div>
            <p className="mt-6 text-[13px] text-[#8C929B]">일정과 옮길 수 있는 범위는 받은 자료를 확인한 뒤 안내합니다. 마지막 확인 {CHECKED}</p>
          </div>
        </section>

        {/* 순서 */}
        <section id="steps" className="scroll-mt-24 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal>
              <h2 className={H2}>이전은 이 순서로 진행됩니다</h2>
              <p className="mt-4 max-w-[36em] text-[16.5px] leading-[1.8] text-[#5B616B]">새 홈페이지를 먼저 만들어 확인하고, 하루를 정해 도메인만 돌립니다. 그래서 지금 홈페이지는 끝까지 멈추지 않습니다.</p>
            </Reveal>
            <ol className="mt-14 space-y-5">
              {STEPS.map((s) => (
                <Reveal key={s.n}>
                  <li className="pn-shell"><div className="pn-core p-6 sm:p-9">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1D3461] text-[16px] font-extrabold text-white tabular-nums">{s.n}</span>
                      <h3 className="text-[21px] font-extrabold tracking-[-0.03em] sm:text-[24px]">{s.t}</h3>
                      <span className="rounded-full bg-[#1D3461]/10 px-3 py-1 text-[12px] font-bold text-[#1D3461]">{s.who === '대표님' ? '대표님이 해 주세요' : s.who === '함께' ? '함께 합니다' : 'IM 뉴스룸이 합니다'}</span>
                    </div>
                    <p className="mt-4 text-[16px] leading-[1.85] text-[#3B4048]">{s.d}</p>
                  </div></li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 준비 자료 */}
        <section>
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6">
            <Reveal><h2 className={H2}>신청 전에 준비해 주세요</h2></Reveal>
            <Reveal>
              <ul className="mt-10 grid gap-3 sm:grid-cols-2">
                {PREPARE.map((x) => (
                  <li key={x} className="flex gap-3 rounded-2xl bg-[#F7F8FA] px-5 py-4 text-[15.5px] leading-relaxed text-[#3B4048] shadow-[inset_0_0_0_1px_rgba(15,17,21,0.06)]">
                    <span className="mt-[2px] shrink-0 font-bold text-[#16294D]" aria-hidden>✓</span><span>{x}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[14px] leading-relaxed text-[#8C929B]">모르는 항목이 있어도 괜찮습니다. 신청서에서 “모르겠음”을 고르시면 상담 때 같이 확인합니다.</p>
            </Reveal>
          </div>
        </section>

        {/* 도메인 */}
        <section id="domain" className="scroll-mt-24 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6">
            <Reveal>
              <h2 className={H2}>도메인은 이렇게 됩니다</h2>
              <p className="mt-4 max-w-[36em] text-[16.5px] leading-[1.8] text-[#5B616B]">도메인(홈페이지 주소)은 대표님 소유입니다. 이전 과정에서 소유자는 바뀌지 않고, 가리키는 곳만 새 홈페이지로 바꿉니다.</p>
            </Reveal>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {DOMAIN.map((x, i) => (
                <Reveal key={x.t} delay={i * 80}>
                  <div className="pn-shell h-full"><div className="pn-core h-full p-7">
                    <p className="text-[18px] font-extrabold tracking-[-0.02em]">{x.t}</p>
                    <p className="mt-3 text-[15px] leading-[1.8] text-[#3B4048]">{x.d}</p>
                  </div></div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <ul className="mt-8 space-y-2.5 text-[15.5px] leading-[1.8] text-[#3B4048]">
                <li className="flex gap-3"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>도메인 메일(@내도메인)을 쓰고 계시면 메일 설정은 건드리지 않습니다.</li>
                <li className="flex gap-3"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>도메인 업체 아이디·비밀번호는 저희에게 보내지 마세요. 설정 값만 바꾸시면 됩니다.</li>
                <li className="flex gap-3"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>전환 뒤 문제가 생기면 값을 예전으로 되돌려 바로 원래대로 돌아옵니다.</li>
              </ul>
              <p className="mt-6"><Link href={`${home}/domain`} className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#1D3461] underline underline-offset-4">새 도메인을 구입하시려면: 도메인 구입 안내 <span aria-hidden>→</span></Link></p>
            </Reveal>
          </div>
        </section>

        {/* 질문 */}
        <section id="faq" className="scroll-mt-24">
          <div className="mx-auto max-w-[820px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal><h2 className={`${H2} text-center`}>이전 전에 가장 많이 묻는 것</h2></Reveal>
            <div className="mt-12 space-y-3">
              {FAQ.map((f) => (
                <Reveal key={f.q}>
                  <details className="pn-shell group">
                    <summary className="pn-core flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#0F1115]/[0.06] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:rotate-45" aria-hidden>
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

        <section className="px-4 pb-28 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[920px]">
            <div className="pn-core flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
              <div>
                <p className="text-[26px] font-extrabold leading-[1.25] tracking-[-0.04em] sm:text-[32px]">지금 홈페이지는 그대로 두고,<br />새 홈페이지부터 확인하세요.</p>
                <p className="mt-3 text-[15.5px] text-[#5B616B]">문의: {ISSUER.contact} · 이메일이나 카카오톡으로 안내합니다.</p>
              </div>
              <Pill href={`${home}#apply`} className="shrink-0">이전 상담 신청</Pill>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-[#DADFE8] bg-[#F7F8FA] text-[13px] text-[#5B616B]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-10 sm:px-6">
          <Link href={home} className="font-bold text-[#0F1115]">IM 뉴스룸</Link>
          <div className="flex flex-wrap gap-5">
            <Link href={`${home}/start`} className="hover:text-[#0F1115]">창간 가이드</Link>
            <Link href={`${home}/domain`} className="hover:text-[#0F1115]">도메인 구입 안내</Link>
            <Link href={`${home}/terms`} className="hover:text-[#0F1115]">이용약관</Link>
            <Link href={`${home}/privacy`} className="font-semibold hover:text-[#0F1115]">개인정보처리방침</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
