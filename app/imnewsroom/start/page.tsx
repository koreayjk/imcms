import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ISSUER, PRODUCT, appLink, isProductHost } from '@/lib/product'
import BrandMark from '@/components/BrandMark'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'

// 인터넷신문 창간 가이드: 새로 신문을 만들려는 사람이 검색으로 들어오는 길
//   법령·기관 기준은 바뀔 수 있어 숫자(인력 수, 기간, 수수료)는 적지 않고, 확인할 곳을 알려 준다
const CHECKED = '2026년 10월'
const TITLE = '인터넷신문 창간 방법: 제호 확인부터 등록·사이트·발행까지'
const DESC = '인터넷신문을 새로 만들 때의 순서와 준비물을 한 번에 정리했습니다. 제호·도메인 정하기, 시·도 등록, 사이트 만들기, 첫 기사 발행, 구글·네이버 검색 등록까지.'

export async function generateMetadata(): Promise<Metadata> {
  // 소개 사이트 주소에서만 검색에 나오게 한다 (편집국 주소 등으로 열린 같은 글은 제외)
  const indexable = PRODUCT.indexable && isProductHost((await headers()).get('host'))
  return {
    title: `${TITLE} | ${PRODUCT.name}`,
    description: DESC,
    openGraph: { title: TITLE, description: DESC, type: 'article', locale: 'ko_KR', images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
    ...(indexable ? { robots: { index: true, follow: true }, alternates: { canonical: `${PRODUCT.url}/start` } } : { robots: { index: false } }),
  }
}

const STEPS = [
  {
    id: 'name',
    n: 1,
    title: '제호와 도메인 정하기',
    who: '직접',
    body: [
      '제호(신문 이름)는 등록하려는 지역의 다른 신문과 같거나 헷갈릴 만큼 비슷하면 곤란합니다. 이름을 정하기 전에 두 가지를 확인하세요.',
    ],
    list: [
      '같은 제호가 이미 등록돼 있는지: 등록을 받는 관할 시·도의 정기간행물 등록 담당 부서에 문의합니다.',
      '비슷한 상표가 있는지: 특허청 키프리스(kipris.or.kr)에서 상표를 검색해 봅니다.',
      '도메인은 제호와 비슷하고 읽기 쉬운 것으로. 나중에 바꾸면 검색에 쌓인 기록이 흩어집니다.',
    ],
  },
  {
    id: 'people',
    n: 2,
    title: '발행인·편집인과 사무실 정하기',
    who: '직접',
    body: [
      '등록 신청에는 발행인과 편집인, 발행소(사무실) 주소와 전화번호가 들어갑니다. 사이트에는 청소년보호책임자도 표시합니다.',
      '등록에 필요한 취재·편집 인력 기준과 증빙 서류는 법령과 해석이 바뀐 적이 있습니다. 신청 전에 관할 시·도에서 최신 기준을 꼭 확인하세요.',
    ],
    list: ['발행인·편집인 정하기 (같은 사람이 맡는 경우도 있습니다)', '발행소 주소와 대표 전화번호 정하기', '청소년보호책임자 정하기'],
  },
  {
    id: 'register',
    n: 3,
    title: '관할 시·도에 인터넷신문 등록',
    who: '직접',
    body: [
      '인터넷신문은 「신문 등의 진흥에 관한 법률」에 따라 발행소가 있는 지역의 시·도(서울은 서울특별시)에 등록합니다. 신청서와 첨부 서류를 내면 등록증과 등록번호가 나옵니다.',
      '필요한 서류, 처리 기간, 수수료는 지역마다 다를 수 있습니다. 신청하기 전에 담당 부서에 전화로 물어보는 것이 가장 빠릅니다.',
    ],
    list: ['신청서와 첨부 서류는 관할 시·도 안내를 따릅니다', '등록 뒤에 받는 등록번호와 등록일을 사이트에 표시합니다'],
  },
  {
    id: 'biz',
    n: 4,
    title: '사업자 등록',
    who: '직접',
    body: ['광고·구독 수익이 생기면 사업자 등록이 필요합니다. 업종과 세금 처리는 상황마다 달라서 세무서나 세무사에게 확인하세요.'],
    list: [],
  },
  {
    id: 'site',
    n: 5,
    title: '사이트 만들기',
    who: 'IM 뉴스룸',
    body: ['등록을 기다리는 동안 사이트와 편집국을 미리 만들어 두면 등록 직후 바로 발행할 수 있습니다. IM 뉴스룸에서는 아래를 맡아 드립니다.'],
    list: [
      '홈페이지 개설: 로고·색, 섹션(메뉴), 첫 화면 구성, 휴대폰 화면',
      '사이트 하단에 법정 표시 정보: 제호·등록번호·등록일·발행인·편집인·청소년보호책임자·발행소 주소·전화',
      '개인정보처리방침·청소년보호정책·이메일무단수집거부 페이지',
      '기자·편집장 계정과 승인 흐름, AI 기사 초안·법적 검수',
    ],
  },
  {
    id: 'publish',
    n: 6,
    title: '발행하고 검색에 올리기',
    who: 'IM 뉴스룸',
    body: [
      '기사를 발행하면 구글 뉴스 형식으로 자동 정리되고, 사이트맵과 RSS가 만들어집니다. 구글 서치콘솔과 네이버 서치어드바이저 등록은 IM 뉴스룸이 대신 해 드립니다.',
      '검색에 기사가 뜨는 것과 네이버·다음 뉴스에 실리는 것(뉴스 제휴)은 다릅니다. 뉴스 제휴는 별도 심사이고 기준이 자주 바뀝니다. 등록 뒤 일정 기간 꾸준히 발행한 기록을 쌓고, 신청할 때는 각 포털의 최신 안내를 확인하세요.',
    ],
    list: [],
  },
]

const FAQ = [
  { q: '창간하는 데 비용이 얼마나 드나요?', a: `등록 수수료, 사무실, 인건비는 지역과 상황마다 다릅니다. ${PRODUCT.name} 이용료는 월 11만 원부터입니다(요금표는 소개 화면 참고). 사이트 제작과 도메인 연결 비용을 따로 받지 않는 기간도 있으니 신청할 때 확인하세요.` },
  { q: '혼자서도 창간할 수 있나요?', a: '등록에 필요한 취재·편집 인력 기준은 법령에서 정하며 바뀐 적이 있습니다. 혼자 가능한지는 관할 시·도 등록 담당 부서에 최신 기준을 물어보는 것이 정확합니다.' },
  { q: '등록하기 전에 사이트를 먼저 만들어도 되나요?', a: '사이트 제작과 시험은 등록 전에도 할 수 있습니다. 다만 신문으로 공개해 기사를 발행하는 시점은 등록 뒤로 잡으세요. 등록 없이 발행하면 문제가 될 수 있으니 등록 담당 부서에 확인하세요.' },
  { q: '등록하면 네이버·다음 뉴스에 바로 나오나요?', a: '아닙니다. 검색에 기사가 노출되는 것은 서치어드바이저·서치콘솔 등록으로 가능하지만, 포털 뉴스 제휴는 별도 신청과 심사가 필요합니다. 심사 기준은 포털마다 다르고 바뀌므로 신청 전에 최신 안내를 확인하세요.' },
  { q: '이미 다른 업체에서 신문을 운영 중인데 옮길 수 있나요?', a: '기사와 사진을 옮기고, 옛 기사 주소로 들어오는 독자와 검색엔진을 새 기사로 넘기는 이전을 지원합니다. 도메인은 그대로 쓸 수 있습니다.' },
  { q: 'AI로 쓴 기사도 발행해도 되나요?', a: 'AI 초안은 초안일 뿐이고 발행 책임은 기자와 편집장에게 있습니다. IM 뉴스룸은 초안에 확인이 필요한 부분을 표시하고 법적 위험을 한 번 더 점검하며, 발행 전에 사람이 확인하는 승인 단계를 둡니다.' },
]

const LINKS = [
  { label: '국가법령정보센터: 「신문 등의 진흥에 관한 법률」과 시행령', href: 'https://www.law.go.kr', note: '법령 이름으로 검색' },
  { label: '문화체육관광부', href: 'https://www.mcst.go.kr', note: '정기간행물·언론 정책 안내' },
  { label: '특허정보검색서비스 키프리스', href: 'https://www.kipris.or.kr', note: '상표 검색' },
  { label: '구글 서치콘솔', href: 'https://search.google.com/search-console', note: '구글 검색 등록' },
  { label: '네이버 서치어드바이저', href: 'https://searchadvisor.naver.com', note: '네이버 검색 등록' },
]

const JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
})

const H2 = 'text-[30px] font-extrabold leading-[1.2] tracking-[-0.04em] [text-wrap:balance] sm:text-[40px]'

export default function StartGuidePage() {
  const home = PRODUCT.path
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSONLD }} />
      <IslandNav
        logo={<span className="flex items-center gap-2"><BrandMark size={34} /><span className="text-[18px] font-extrabold tracking-[-0.02em]">IM 뉴스룸</span></span>}
        items={[{ href: home, label: '소개' }, { href: '#steps', label: '창간 순서' }, { href: '#who', label: '누가 하나요' }, { href: '#faq', label: '자주 묻는 질문' }, { href: `${home}#designs`, label: '디자인 샘플' }, { href: `${home}#pricing`, label: '요금' }]}
        loginHref={appLink('/login')}
        trialHref={appLink('/trial')}
      />

      <main id="top">
        {/* 첫 화면 */}
        <section className="relative isolate overflow-hidden pb-24 pt-36 sm:pt-44">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_80%_10%,rgba(29,52,97,0.12),transparent_70%),radial-gradient(40%_35%_at_6%_80%,rgba(232,89,12,0.06),transparent_70%),linear-gradient(180deg,#F1F4F9_0%,#FFFFFF_85%)]" aria-hidden />
          <div className="mx-auto max-w-[920px] px-4 sm:px-6">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-semibold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(29,52,97,0.14)]">창간 가이드</p>
            <h1 className="mt-6 text-[40px] font-extrabold leading-[1.1] tracking-[-0.05em] [text-wrap:balance] sm:text-[60px]">
              인터넷신문 창간,<br /><span className="text-[#1D3461]">무엇부터 하면 될까요?</span>
            </h1>
            <p className="mt-6 max-w-[36em] text-[17.5px] leading-[1.8] text-[#5B616B]">
              제호 정하기부터 시·도 등록, 사이트 만들기, 첫 기사 발행, 검색 등록까지. 순서와 준비물을 한 번에 정리했습니다.
              법령과 심사 기준은 바뀔 수 있어서, 신청 전에는 반드시 아래 기관에서 최신 내용을 확인하세요.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Pill href={appLink('/trial')}>1주일 무료 체험 시작</Pill>
              <Pill href={`${home}#apply`} tone="light">창간 상담 신청</Pill>
            </div>
            <p className="mt-6 text-[13px] text-[#8C929B]">일반 안내이며 법률·세무 자문이 아닙니다. 마지막 확인 {CHECKED}</p>
          </div>
        </section>

        {/* 순서 */}
        <section id="steps" className="scroll-mt-24 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal>
              <h2 className={H2}>창간은 이 순서로 진행됩니다</h2>
              <p className="mt-4 max-w-[36em] text-[16.5px] leading-[1.8] text-[#5B616B]">1~4번은 직접 하셔야 하는 일이고, 5~6번은 IM 뉴스룸이 맡습니다. 등록을 기다리는 동안 5번을 미리 해 두면 시간을 아낄 수 있습니다.</p>
            </Reveal>
            <ol className="mt-14 space-y-5">
              {STEPS.map((s) => (
                <Reveal key={s.id}>
                  <li id={s.id} className="pn-shell scroll-mt-24">
                    <div className="pn-core p-6 sm:p-9">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#1D3461] text-[16px] font-extrabold text-white tabular-nums">{s.n}</span>
                        <h3 className="text-[22px] font-extrabold tracking-[-0.03em] sm:text-[25px]">{s.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${s.who === '직접' ? 'bg-[#0F1115]/[0.06] text-[#3B4048]' : 'bg-[#1D3461]/10 text-[#1D3461]'}`}>{s.who === '직접' ? '직접 하는 일' : 'IM 뉴스룸이 해 드려요'}</span>
                      </div>
                      <div className="mt-5 space-y-3 text-[16px] leading-[1.85] text-[#3B4048]">
                        {s.body.map((p) => <p key={p}>{p}</p>)}
                      </div>
                      {s.list.length > 0 && (
                        <ul className="mt-5 space-y-2.5">
                          {s.list.map((l) => (
                            <li key={l} className="flex gap-3 text-[15.5px] leading-relaxed text-[#3B4048]">
                              <span className="mt-[3px] shrink-0 text-[14px] font-bold text-[#16294D]" aria-hidden>✓</span>
                              <span>{l}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* 누가 하나 */}
        <section id="who" className="scroll-mt-24">
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal>
              <h2 className={H2}>누가 무엇을 하나요</h2>
            </Reveal>
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              <Reveal>
                <div className="pn-shell h-full"><div className="pn-core h-full p-7">
                  <p className="text-[13px] font-bold tracking-[0.04em] text-[#5B616B]">창간하시는 분이</p>
                  <ul className="mt-4 space-y-3 text-[15.5px] leading-relaxed text-[#3B4048]">
                    {['제호·도메인 정하기와 확인', '발행인·편집인·청소년보호책임자 정하기', '시·도 등록 신청', '사업자 등록', '기자 구하기와 취재, 기사 확인과 발행 결정'].map((x) => <li key={x} className="flex gap-3"><span className="text-[#8C929B]" aria-hidden>•</span>{x}</li>)}
                  </ul>
                </div></div>
              </Reveal>
              <Reveal delay={100}>
                <div className="pn-shell h-full"><div className="pn-core h-full p-7">
                  <p className="text-[13px] font-bold tracking-[0.04em] text-[#1D3461]">{PRODUCT.name}이</p>
                  <ul className="mt-4 space-y-3 text-[15.5px] leading-relaxed text-[#3B4048]">
                    {['홈페이지 개설과 법정 표시 정보, 정책 페이지', '기사 작성·승인·발행 편집국', '보도자료 자동 수집과 AI 기사 초안·법적 검수', '구글·네이버 검색 등록과 사이트맵·RSS', '뉴스레터, 광고 배너, 다른 업체에서 옮기기'].map((x) => <li key={x} className="flex gap-3"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>{x}</li>)}
                  </ul>
                </div></div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section id="faq" className="scroll-mt-24 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[820px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal><h2 className={`${H2} text-center`}>창간 전에 가장 많이 묻는 것</h2></Reveal>
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

        {/* 공식 확인처 */}
        <section>
          <div className="mx-auto max-w-[920px] px-4 py-24 sm:px-6">
            <Reveal>
              <h2 className="text-[26px] font-extrabold tracking-[-0.03em] sm:text-[32px]">신청하기 전에 확인할 곳</h2>
              <p className="mt-3 max-w-[38em] text-[15.5px] leading-[1.8] text-[#5B616B]">등록 요건, 서류, 처리 기간, 제휴 심사 기준은 기관이 정하고 바뀔 수 있습니다. 아래 공식 사이트나 담당 부서에서 최신 내용을 확인하세요.</p>
            </Reveal>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="pn-press group flex items-center justify-between gap-4 rounded-2xl bg-[#F7F8FA] px-5 py-4 shadow-[inset_0_0_0_1px_rgba(15,17,21,0.06)] hover:bg-[#EEF1F6]">
                    <span>
                      <span className="block text-[15px] font-bold leading-snug">{l.label}</span>
                      <span className="mt-0.5 block text-[13px] text-[#8C929B]">{l.note}</span>
                    </span>
                    <span className="shrink-0 text-[#8C929B] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1" aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 맺음 */}
        <section className="px-4 pb-28 sm:px-6">
          <Reveal className="pn-shell mx-auto max-w-[920px]">
            <div className="pn-core flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12">
              <div>
                <p className="text-[26px] font-extrabold leading-[1.25] tracking-[-0.04em] sm:text-[32px]">등록을 기다리는 동안<br />사이트를 먼저 만들어 두세요.</p>
                <p className="mt-3 text-[15.5px] text-[#5B616B]">1주일 동안 모든 기능을 무료로 써 볼 수 있습니다. 카드 등록은 필요 없습니다.</p>
              </div>
              <Pill href={appLink('/trial')} className="shrink-0">1주일 무료 체험 시작</Pill>
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
          <p className="w-full text-[12px] leading-relaxed">운영: {ISSUER.company ?? PRODUCT.nameEn} · 문의 <a href={`mailto:${ISSUER.contact}`} className="underline hover:text-[#0F1115]">{ISSUER.contact}</a></p>
        </div>
      </footer>
    </div>
  )
}
