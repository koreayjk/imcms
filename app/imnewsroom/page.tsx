import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { PRODUCT, isProductHost } from '@/lib/product'
import ProofDemo from '@/components/product/ProofDemo'
import ApplyForm from '@/components/product/ApplyForm'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  const indexable = PRODUCT.indexable && isProductHost(headers().get('host'))
  return {
    title: `${PRODUCT.name} — 1인 언론사에도 뉴스룸이 생깁니다`,
    description: '보도자료 자동 수집, AI 기사 초안, 기자·편집장 승인, 여러 매체 동시 송고까지. 인터넷신문을 위한 AI 편집국 클라우드.',
    ...(indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

// 기사가 나가기까지의 실제 순서 — 번호가 곧 작업 순서다
const STEPS = [
  { title: '모은다', body: '뉴스와이어·정책브리핑 보도자료를 30분마다 자동으로 가져옵니다. 이메일로 받은 자료는 붙여넣기 한 번이면 같은 함에 들어갑니다.' },
  { title: '고른다', body: '매체 분야에 맞는 보도자료만 추천 탭에 모아 보여줍니다. 이미 기사로 쓴 자료는 표시가 붙어 중복을 막습니다.' },
  { title: '쓴다', body: 'AI가 원문에 있는 사실만으로 기사체 초안을 씁니다. 홍보 문구와 연락처는 빼고, 확인이 필요한 부분은 메모로 남깁니다.' },
  { title: '확인한다', body: '초안은 항상 ‘작성중’으로 저장됩니다. 기자가 다듬어 승인을 신청하고, 편집장이 확인해 발행합니다.' },
  { title: '내보낸다', body: '홈페이지 톱·주요 기사 자리를 편집장이 직접 정하고, 필요하면 운영 중인 다른 매체에도 한 번에 송고합니다.' },
]

const FEATURES = [
  { title: '여러 매체를 한 계정으로', body: '기사 한 건을 골라서 다른 매체에 함께 송고합니다. 사본에는 원본 표시가 붙어 검색엔진 중복 문서로 잡히지 않습니다.' },
  { title: '기자 → 편집장 승인', body: '작성중, 승인신청, 반려, 발행 상태를 한눈에 봅니다. 반려할 때는 사유를 남깁니다.' },
  { title: '홈 편집판', body: '헤드라인, 톱, 주요 기사, 추천 자리에 어떤 기사를 둘지 편집장이 고릅니다. 비워 두면 최신 기사로 채워집니다.' },
  { title: '모바일에 맞춘 신문 사이트', body: 'PC와 휴대폰 화면을 따로 만들 필요가 없습니다. 휴대폰에서는 왼쪽에서 열리는 메뉴로 섹션을 오갑니다.' },
  { title: '검색 노출 설정', body: '기사마다 검색 결과 제목과 설명을 따로 적을 수 있습니다. 공유할 때 나오는 사진도 자동으로 정해집니다.' },
  { title: '가입과 권한 관리', body: '구글 계정으로 가입하고, 관리자가 승인해야 기사를 쓸 수 있습니다. 역할과 소속 매체는 관리자가 정합니다.' },
]

const FAQ = [
  { q: 'AI가 쓴 기사가 그대로 홈페이지에 올라가나요?', a: '아니요. AI 초안은 항상 ‘작성중’ 상태로 저장되고, 기자가 원문과 대조해 고친 뒤에만 발행됩니다. AI가 확인이 필요하다고 본 부분은 편집 화면에 메모로 표시됩니다.' },
  { q: '지금 쓰는 도메인을 그대로 쓸 수 있나요?', a: '네. 도메인을 산 곳에서 연결 주소만 바꾸면 됩니다. 저희가 설정 방법을 안내해 드립니다.' },
  { q: '기존 프로그램에 있는 기사를 옮길 수 있나요?', a: '베타 고객사는 저희가 직접 옮겨 드립니다. 기존 프로그램에서 내보낼 수 있는 형식에 따라 방법이 달라서, 상담할 때 함께 확인합니다.' },
  { q: '서버나 프로그램을 설치해야 하나요?', a: '아니요. 웹브라우저에서 로그인해 바로 씁니다. 서버, 백업, 보안 업데이트는 저희가 관리합니다.' },
  { q: '보도자료를 자유롭게 기사로 써도 되나요?', a: '배포처 약관을 따라야 합니다. 예를 들어 뉴스와이어는 언론사가 하루 5건을 넘게 쓰려면 사전 허락이 필요합니다. 보도자료함에 오늘 사용한 건수가 표시됩니다.' },
  { q: '정식 요금은 얼마인가요?', a: '베타 기간이 끝나기 전에 안내하고, 베타 고객사에 가장 먼저 알려 드립니다.' },
]

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-[5px] bg-[#14171C] text-[11px] font-black tracking-tight text-[#F2B544]">IM</span>
      <span className="text-[17px] font-extrabold tracking-[-0.02em]">뉴스룸</span>
    </span>
  )
}

export default function ProductHome() {
  return (
    <div className="min-h-screen bg-white text-[#14171C] [word-break:keep-all]" style={{ ['--serif' as string]: "'Noto Serif KR', Georgia, serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&display=swap" />

      <header className="sticky top-0 z-30 border-b border-[#E4E6EA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1160px] items-center gap-6 px-4 sm:px-6">
          <a href="#top" aria-label={`${PRODUCT.name} 처음으로`}><Logo /></a>
          <nav className="ml-auto hidden items-center gap-7 text-[14px] text-[#3B4048] md:flex" aria-label="소개 메뉴">
            <a href="#how" className="hover:text-[#14171C]">작동 방식</a>
            <a href="#features" className="hover:text-[#14171C]">기능</a>
            <a href="#beta" className="hover:text-[#14171C]">베타 모집</a>
            <a href="#faq" className="hover:text-[#14171C]">자주 묻는 질문</a>
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/login" className="rounded-md px-3 py-2 text-[13.5px] text-[#3B4048] hover:text-[#14171C]">편집국 로그인</Link>
            <a href="#apply" className="rounded-md bg-[#14171C] px-3.5 py-2 text-[13.5px] font-semibold text-white hover:opacity-90">베타 신청</a>
          </div>
        </div>
      </header>

      <main id="top">
        {/* 첫 화면: 무엇을 해주는지를 시연으로 보여준다 */}
        <section className="mx-auto grid max-w-[1160px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:grid-cols-[1.05fr_1fr] md:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#E4E6EA] px-3 py-1 text-[12.5px] font-semibold text-[#3B4048]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D6402B]" />
              인터넷신문을 위한 AI 편집국 · 베타 고객사 모집 중
            </p>
            <h1 className="mt-6 text-[40px] font-extrabold leading-[1.15] tracking-[-0.035em] [text-wrap:balance] sm:text-[54px]">
              1인 언론사에도
              <br />
              뉴스룸이 생깁니다.
            </h1>
            <p className="mt-6 max-w-[34em] text-[17px] leading-[1.75] text-[#3B4048]">
              보도자료 수집부터 AI 기사 초안, 승인, 발행, 여러 매체 동시 송고까지.
              반복 업무는 {PRODUCT.name}이 맡고, 기자는 취재와 확인에 집중합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#apply" className="rounded-md bg-[#D6402B] px-6 py-3.5 text-[15px] font-bold text-white hover:opacity-90">베타 고객사 신청</a>
              <a href="#how" className="rounded-md border border-[#D5D8DD] px-6 py-3.5 text-[15px] font-semibold hover:border-[#14171C]">작동 방식 보기</a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-1.5 text-[13.5px] text-[#5B616B]">
              <li>✓ 설치 없이 웹에서</li>
              <li>✓ 쓰던 도메인 그대로</li>
              <li>✓ 기존 기사 이전 지원</li>
            </ul>
          </div>
          <ProofDemo />
        </section>

        {/* 작동 방식: 실제 작업 순서 */}
        <section id="how" className="scroll-mt-16 border-t border-[#E4E6EA] bg-[#F4F5F7]">
          <div className="mx-auto max-w-[1160px] px-4 py-20 sm:px-6">
            <h2 className="text-[30px] font-extrabold tracking-[-0.03em] sm:text-[36px]">보도자료 한 건이 기사가 되는 길</h2>
            <p className="mt-3 max-w-[40em] text-[16px] leading-relaxed text-[#3B4048]">
              기자가 하던 일 중 옮겨 적기, 홍보 문구 걷어내기, 사진 정리는 {PRODUCT.name}이 합니다. 판단과 확인은 사람이 합니다.
            </p>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-lg border border-[#E4E6EA] bg-[#E4E6EA] md:grid-cols-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="bg-white p-6">
                  <p className="text-[13px] font-bold tabular-nums text-[#D6402B]">{String(i + 1).padStart(2, '0')}</p>
                  <p className="mt-2 text-[20px] font-extrabold tracking-[-0.02em]">{s.title}</p>
                  <p className="mt-2.5 text-[14px] leading-[1.7] text-[#3B4048]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 기능 */}
        <section id="features" className="scroll-mt-16">
          <div className="mx-auto max-w-[1160px] px-4 py-20 sm:px-6">
            <h2 className="text-[30px] font-extrabold tracking-[-0.03em] sm:text-[36px]">편집국에 필요한 것은 다 있습니다</h2>
            <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="border-t-2 border-[#14171C] pt-4">
                  <h3 className="text-[17px] font-bold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-[1.75] text-[#3B4048]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 우리가 먼저 쓴다 */}
        <section className="bg-[#14171C] text-white">
          <div className="mx-auto grid max-w-[1160px] gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
            <h2 className="text-[26px] font-extrabold leading-snug tracking-[-0.03em] sm:text-[32px]">
              저희 매체가
              <br />
              먼저 씁니다.
            </h2>
            <p className="text-[16px] leading-[1.8] text-[#C9CDD3]">
              {PRODUCT.name}은 저희가 직접 운영하는 인터넷신문을 위해 만들었습니다.
              보건·복지·요양 전문지 <strong className="font-semibold text-white">더케어타임즈</strong>를 시작으로 운영 매체를 차례로 옮기고 있습니다.
              매일 쓰면서 불편한 점을 먼저 고치니, 현장에서 필요한 기능이 먼저 들어갑니다.
            </p>
          </div>
        </section>

        {/* 베타 조건 */}
        <section id="beta" className="scroll-mt-16">
          <div className="mx-auto max-w-[1160px] px-4 py-20 sm:px-6">
            <p className="text-[13px] font-bold tracking-[0.06em] text-[#D6402B]">베타 고객사 모집</p>
            <h2 className="mt-2 text-[30px] font-extrabold tracking-[-0.03em] sm:text-[36px]">함께 만들 언론사를 먼저 모십니다</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-[#E4E6EA] p-7">
                <h3 className="text-[17px] font-bold">베타 고객사 혜택</h3>
                <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#3B4048]">
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>베타 기간 이용료 없음</li>
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>기존 기사·사진 이전을 저희가 직접 진행</li>
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>필요한 기능을 개발 순서에 먼저 반영</li>
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>담당자가 개통부터 운영까지 1:1로 지원</li>
                </ul>
              </div>
              <div className="rounded-lg border border-[#E4E6EA] p-7">
                <h3 className="text-[17px] font-bold">이런 곳에 잘 맞습니다</h3>
                <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#3B4048]">
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>기자 1~5명이 매일 기사를 내는 인터넷신문</li>
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>매체를 두 개 이상 운영하는 발행인</li>
                  <li className="flex gap-3"><span className="font-bold text-[#D6402B]">·</span>창간을 준비하며 프로그램을 고르는 중인 곳</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 자주 묻는 질문 */}
        <section id="faq" className="scroll-mt-16 border-t border-[#E4E6EA] bg-[#F4F5F7]">
          <div className="mx-auto max-w-[860px] px-4 py-20 sm:px-6">
            <h2 className="text-[30px] font-extrabold tracking-[-0.03em] sm:text-[36px]">자주 묻는 질문</h2>
            <div className="mt-8 divide-y divide-[#E4E6EA] rounded-lg border border-[#E4E6EA] bg-white">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-[20px] font-normal text-[#8C929B] transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-[1.8] text-[#3B4048]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 신청 */}
        <section id="apply" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1160px] gap-10 px-4 py-20 sm:px-6 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="text-[30px] font-extrabold leading-snug tracking-[-0.03em] sm:text-[36px]">
                베타 고객사
                <br />
                신청
              </h2>
              <p className="mt-4 text-[16px] leading-[1.8] text-[#3B4048]">
                신청서를 보내주시면 담당자가 연락드려 운영 중인 매체와 필요한 기능을 여쭤봅니다. 신청했다고 비용이 생기지 않습니다.
              </p>
            </div>
            <ApplyForm />
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E4E6EA]">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-[#5B616B] sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span>인터넷신문을 위한 AI 편집국</span>
          </div>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-[#14171C]">편집국 로그인</Link>
            <a href="#apply" className="hover:text-[#14171C]">상담 신청</a>
          </div>
          <p className="w-full text-[12px]">© {new Date().getFullYear()} {PRODUCT.nameEn}</p>
        </div>
      </footer>
    </div>
  )
}
