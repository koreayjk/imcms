import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { PRODUCT, isProductHost } from '@/lib/product'
import { ANNUAL_FREE, ANNUAL_MONTHS, BETA_END_LABEL, PLANS, REGULAR_FROM_LABEL, betaDaysLeft, isBeta, planCharge, won } from '@/lib/pricing'
import ProofDemo from '@/components/product/ProofDemo'
import ApplyForm from '@/components/product/ApplyForm'
import { Browser, Phone } from '@/components/product/Devices'
import { ApprovalFlow, HomeBoardMock, MailForwardVisual, PressInboxMock, SupportMock, SyndicateVisual, TeamMock } from '@/components/product/Mockups'
import IndexWidget from '@/components/site/IndexWidget'
import type { IndexSeries } from '@/lib/market-index'
import { CountUp, Reveal } from '@/components/product/Motion'
import Pricing from '@/components/product/Pricing'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  const indexable = PRODUCT.indexable && isProductHost(headers().get('host'))
  return {
    title: `${PRODUCT.name} — 1인 언론사에도 뉴스룸이 생깁니다`,
    description: '보도자료 자동 수집, AI 기사 초안, 기자·편집장 승인, 여러 매체 동시 송고까지. 인터넷신문을 위한 AI 편집국 클라우드.',
    ...(indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

const IMG = '/imnewsroom'

// 기사가 나가기까지의 실제 순서 — 번호가 곧 작업 순서다
const STEPS = [
  { title: '모은다', body: '보도자료를 30분마다 자동 수집. 기자 메일로 온 자료도 자동으로.', color: '#E5483A' },
  { title: '고른다', body: '매체 분야에 맞는 자료만 추천. 이미 쓴 자료는 표시.', color: '#F5A524' },
  { title: '쓴다', body: 'AI가 원문 사실만으로 기사체 초안과 확인 메모 작성.', color: '#8B5CF6' },
  { title: '확인한다', body: '기자가 다듬고, 편집장이 승인해 발행.', color: '#3B82F6' },
  { title: '내보낸다', body: '홈 편집판에 배치하고 다른 매체에도 한 번에 송고.', color: '#10B981' },
]

type Icon = keyof typeof ICONS
const ICONS = {
  inbox: <path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6" /></>,
  layout: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M10 10v10" /></>,
  check: <><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
  photo: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m21 16-5-5-8 8" /></>,
  cloud: <path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.8 3.8 0 0 1 17.5 18H7Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /></>,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3ZM9 8h6M9 12h6" />,
  pen: <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  doc: <><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  chart: <path d="M4 19h16M6 16l4-5 3 3 5-7" />,
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4.5l3 2" />,
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  scale: <path d="M12 4v16M7 20h10M4 8h16M6 8l-3 6a3 3 0 0 0 6 0L6 8ZM18 8l-3 6a3 3 0 0 0 6 0l-3-6Z" />,
}

function Glyph({ name, className = '' }: { name: Icon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {ICONS[name]}
    </svg>
  )
}

const FEATURES: { icon: Icon; title: string; body: string; color: string }[] = [
  { icon: 'inbox', title: '보도자료 자동 수집', body: '뉴스와이어 14개 분야를 30분마다, 사진·영상까지', color: '#E5483A' },
  { icon: 'mail', title: '메일로 받은 보도자료', body: '지메일 필터로 보도자료 메일만, 첨부 사진도 본문에', color: '#EA4335' },
  { icon: 'spark', title: 'AI 기사 초안', body: 'Gemini 기본·Claude 선택, 원문 대조 자동 점검', color: '#8B5CF6' },
  { icon: 'scale', title: 'AI 법적 검수', body: '명예훼손·저작권·개인정보 위험 문장을 찾아 고칠 문장까지', color: '#DC2626' },
  { icon: 'layout', title: '홈페이지 모양 미리보기', body: '실제 홈페이지 화면(PC·모바일)으로 보고 제출', color: '#2563EB' },
  { icon: 'link', title: '기사 링크 바로 받기', body: '발행 전에도 저장만 하면 미리보기 링크 공유', color: '#0891B2' },
  { icon: 'photo', title: '사진 워터마크', body: '올리는 사진에 매체 이름을 자동으로', color: '#9333EA' },
  { icon: 'chart', title: 'AI 모델 비교', body: '우리 보도자료로 AI끼리 블라인드 비교·검토', color: '#7C3AED' },
  { icon: 'doc', title: '한글·워드 파일 읽기', body: '.hwp·.docx 보도자료를 올리면 본문·제목이 쏙', color: '#0EA5E9' },
  { icon: 'clock', title: '예약 발행', body: '지정한 시각에 공개, 지난 날짜 발행도', color: '#6D28D9' },
  { icon: 'share', title: '여러 매체 함께 송고', body: '매체마다 AI가 문장을 바꿔 올리고, 원본 표시로 중복 방지', color: '#F5A524' },
  { icon: 'layout', title: '홈 편집판', body: '헤드라인·톱·주요 자리를 편집장이 직접', color: '#3B82F6' },
  { icon: 'check', title: '기자 → 편집장 승인', body: '작성중·승인신청·반려·발행 상태 관리', color: '#10B981' },
  { icon: 'users', title: '매체별 직급', body: 'A매체 편집장·B매체 기자, 상단바에서 전환', color: '#6366F1' },
  { icon: 'shield', title: '가입 → 발행인 승인', body: '가입 때 소속 매체 선택, 그 매체 발행인이 승인', color: '#0F766E' },
  { icon: 'phone', title: '휴대폰 편집국', body: '현장에서 휴대폰으로 쓰고 승인·발행', color: '#EC4899' },
  { icon: 'history', title: '자동 임시 저장·수정 이력', body: '컴퓨터가 꺼져도 쓰던 글 그대로, 발행 뒤 고친 내용은 기록·되돌리기', color: '#F97316' },
  { icon: 'chart', title: '기자별 AI 사용량', body: '매체 한도를 인원수로 자동 배분, 편집장이 조정', color: '#65A30D' },
  { icon: 'search', title: '검색·포털 노출', body: '뉴스 사이트맵·RSS 자동, 기사별 검색 제목·공유 이미지', color: '#06B6D4' },
  { icon: 'headset', title: '고객센터 내장', body: '업무요청은 담당 매니저에게 자동 배정', color: '#14B8A6' },
  { icon: 'receipt', title: '청구서·온라인 결제', body: '국내 카드·카카오페이·네이버페이 결제, 자동결제', color: '#A855F7' },
]

const FAQ = [
  { q: 'AI가 쓴 기사가 그대로 홈페이지에 올라가나요?', a: '아니요. AI 초안은 항상 ‘작성중’ 상태로 저장되고, 기자가 원문과 대조해 고친 뒤에만 발행됩니다. AI가 확인이 필요하다고 본 부분은 편집 화면에 메모로 표시됩니다.' },
  { q: 'AI가 법적인 문제도 봐 주나요?', a: '네. 기사쓰기에서 “AI 검수”를 누르면 명예훼손·모욕, 개인정보·초상권, 저작권(도용), 기사형 광고 등 문제가 될 수 있는 문장을 찾아 이유와 고칠 문장을 보여 줍니다. 항목마다 바꿀지 그대로 둘지 고르면 바로 반영되고, 검수 기록은 편집장 승인 화면에도 남습니다. 참고용 점검이며 법률 자문은 아닙니다.' },
  { q: '발행 전 기사를 취재원이나 편집장에게 미리 보여줄 수 있나요?', a: '네. 저장만 하면 “기사 링크 복사”로 미리보기 링크를 받을 수 있습니다. 받은 사람은 로그인 없이 실제 홈페이지 모양으로 볼 수 있고, 검색엔진에는 노출되지 않습니다. 발행되면 같은 링크가 실제 기사로 연결됩니다.' },
  { q: '쓰다가 컴퓨터가 꺼지면 어떻게 되나요?', a: '쓰는 내용은 고칠 때마다 그 브라우저에 자동으로 임시 저장됩니다. 다시 기사쓰기를 열면 쓰던 내용이 그대로 나옵니다. “저장”을 누르면 기사목록에 들어갑니다.' },
  { q: '지금 쓰는 도메인을 그대로 쓸 수 있나요?', a: '네. 도메인을 산 곳에서 연결 주소만 바꾸면 됩니다. 저희가 설정 방법을 안내해 드립니다.' },
  { q: '기존 프로그램에 있는 기사를 옮길 수 있나요?', a: '네. 신청하시면 저희가 직접 옮겨 드립니다. 기존 프로그램에서 내보낼 수 있는 형식에 따라 방법이 달라서, 상담할 때 함께 확인합니다.' },
  { q: '서버나 프로그램을 설치해야 하나요?', a: '아니요. 웹브라우저에서 로그인해 바로 씁니다. 서버, 백업, 보안 업데이트는 저희가 관리합니다.' },
  { q: '보도자료를 자유롭게 기사로 써도 되나요?', a: '배포처 약관을 따라야 합니다. 예를 들어 뉴스와이어는 언론사가 하루 5건을 넘게 쓰려면 사전 허락이 필요합니다. 보도자료함에 오늘 사용한 건수가 표시됩니다.' },
  { q: '기자 메일로 받은 보도자료도 모을 수 있나요?', a: '네. 기자마다 전용 전달 주소가 생기고, 지메일에서 “보도자료” 메일만 그 주소로 자동 전달하도록 한 번 설정하면 됩니다. 네이버·다음 메일은 자동 전달 기능이 없어 “전달” 버튼으로 보내면 됩니다. 설정 방법은 화면에서 단계별로 안내합니다.' },
  { q: '문의나 수정 요청은 어떻게 하나요?', a: '편집국 화면의 “고객센터”에서 업무요청을 남기면 운영팀이 답변합니다. 따로 된 사이트에 로그인할 필요가 없고, 답변이 오면 메뉴에 숫자로 표시됩니다.' },
  { q: '기사를 정해 둔 시각에 올릴 수 있나요?', a: '네. 기사쓰기에서 발행 일시를 앞으로의 시각으로 정하면 예약 발행됩니다. 그 시각 전까지는 홈페이지에 보이지 않고, 지난 날짜를 고르면 그 날짜로 발행됩니다. 시간은 한국 시간 기준입니다.' },
  { q: '한 기자가 여러 매체에서 일할 수 있나요?', a: '네. 같은 그룹 안에서 여러 매체에 소속되고, 매체마다 직급을 따로 가질 수 있습니다(예: A매체 편집장, B매체 기자). 상단바에서 매체를 바꾸면 그 매체의 직급으로 바뀝니다.' },
  { q: '휴대폰으로도 기사를 쓸 수 있나요?', a: '네. 편집국 화면이 휴대폰에 맞게 바뀌어 현장에서 바로 쓰고, 편집장은 휴대폰으로 승인·발행할 수 있습니다.' },
]

// 요금 질문은 베타 기간(12월 30일까지)인지에 따라 답이 바뀐다
function pricingFaq(beta: boolean) {
  return [
    { q: '무료 체험은 어떻게 하나요?', a: '“1주일 무료 체험”에서 이름·연락처·소속 언론사만 적으면 바로 시작합니다. 카드 등록이나 결제는 없습니다. 샘플 기사가 채워진 체험용 신문에서 기자·편집장·그룹장 역할을 바꿔 가며 모든 기능을 써 볼 수 있고, 7일이 지나면 자동으로 끝납니다.' },
    ...(beta ? [{ q: '베타 반값은 언제까지인가요?', a: `IM 뉴스룸 정식 출시 전 베타 기간입니다. ${BETA_END_LABEL}까지 신청한 신문사는 2026년 12월분 이용료까지 반값이고, ${REGULAR_FROM_LABEL}분부터 정상가입니다. 베타 기간에 신청하시면 세팅비도 무료입니다.` }] : []),
    { q: '요금은 얼마인가요?', a: `베이직 월 110,000원, 스탠다드 월 150,000원, 프리미엄 월 230,000원이고 모두 부가세(VAT) 포함 금액입니다. 기자 계정은 모든 요금제에서 무제한이고, AI 사용 횟수(초안·법적 검수)·저장 용량에 따라 나뉩니다.${beta ? ` 지금 베타 기간(${BETA_END_LABEL}까지)에 신청하시면 2026년 12월분까지 반값입니다.` : ''}` },
    { q: '1년 한 번에 결제하면 할인되나요?', a: `네. 1년 요금을 한 번에 내시면 ${ANNUAL_FREE}라 12개월을 ${ANNUAL_MONTHS}개월 값으로 씁니다.${beta ? ` 베타 기간에는 12개월 중 2026년 12월분까지를 반값으로 계산한 뒤 ${ANNUAL_FREE}를 적용합니다. 예: 지금 베이직 1년 ${won(planCharge(PLANS[0], 'annual', true)!.price)}.` : ''}` },
    { q: '세팅비는 무엇인가요?', a: `처음 개통할 때 한 번만 내는 150,000원(VAT 포함)입니다. 편집국·홈페이지 개설, 로고·색 등 맞춤 적용, 법정 표기·정책 페이지, 도메인 연결, 기존 기사·사진 옮기기와 옛 주소 연결, 포털 검색 등록 준비, 사용법 1:1 안내가 들어 있습니다.${beta ? ` 베타 기간(${BETA_END_LABEL}까지)에 신청하시면 세팅비는 무료입니다.` : ''}` },
  ]
}

const MARQUEE = ['여러 매체 한 계정', '보도자료 자동 수집', '메일로 받은 보도자료', 'AI 기사 초안', 'AI 법적 검수', '홈페이지 모양 미리보기', '미리보기 링크 공유', '사진 워터마크', 'AI 모델 비교', '예약 발행', '매체별 직급', '휴대폰 편집국', '워드 파일 읽기', '업종 위젯', '고객센터 내장', '홈 편집판', '모바일 신문', '승인 흐름', '구글 로그인']

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`grid h-8 w-8 place-items-center rounded-md text-[11px] font-black tracking-tight ${dark ? 'bg-white text-[#1F4FD0]' : 'bg-[#1F4FD0] text-white'}`}>IM</span>
      <span className={`text-[18px] font-extrabold tracking-[-0.02em] ${dark ? 'text-white' : ''}`}>뉴스룸</span>
    </span>
  )
}

function Eyebrow({ icon, color, children }: { icon: Icon; color: string; children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.06em]" style={{ color }}>
      <Glyph name={icon} className="h-[17px] w-[17px]" />
      {children}
    </p>
  )
}

function Check({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <li className={`flex gap-3 text-[15.5px] leading-relaxed ${dark ? 'text-[#5B616B]' : 'text-[#3B4048]'}`}>
      <span className={`mt-[3px] shrink-0 text-[14px] font-bold ${dark ? 'text-[#1F4FD0]' : 'text-[#14306E]'}`} aria-hidden>✓</span>
      <span>{children}</span>
    </li>
  )
}

// 전문지 맞춤 섹션의 운임지수 위젯 예시 (샘플 값, 화면에 “샘플” 표시)
const weeks = (start: string, vals: number[]) => vals.map((value, i) => ({ date: new Date(Date.parse(start) + i * 7 * 864e5).toISOString().slice(0, 10), value, sample: true }))
const DEMO_INDEX: IndexSeries = {
  scfi: weeks('2026-07-17', [1654.61, 1610.2, 1598.4, 1560.9, 1572.3, 1521.8, 1490.2, 1466.7, 1402.5, 1388.9, 1301.4, 1220.55]),
  kcci: weeks('2026-07-13', [2350.62, 2331.1, 2290.4, 2302.8, 2260.3, 2231.5, 2205.9, 2188.2, 2150.6, 2131.2, 2110.4, 2096.64]),
}

const H2 = 'text-[30px] font-extrabold leading-[1.25] tracking-[-0.03em] [text-wrap:balance] sm:text-[40px]'

// 1주일 무료 체험 버튼 (소개 페이지 곳곳에)
function TrialButton({ className = '', children = '1주일 무료 체험 시작 →' }: { className?: string; children?: React.ReactNode }) {
  return <Link href="/trial" className={className}>{children}</Link>
}

// 섹션 사이 띠: 지금 바로 1주일 무료로
function TrialStrip({ beta }: { beta: boolean }) {
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 border-y border-[#E3E7EE] px-2 py-7 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[18px] font-extrabold leading-snug tracking-[-0.03em] text-[#0F1115] sm:text-[21px]">
          말로 듣는 것보다 직접 써 보는 게 빠릅니다.
          <span className="block text-[14.5px] font-medium text-[#5B616B]">{beta ? <>첫 1주일은 무료, <b className="font-semibold text-[#C2410C]">{BETA_END_LABEL}까지 가입하면 모든 요금 반값</b></> : '첫 1주일은 무료로 모든 기능을 써 보세요'}</span>
        </p>
        <TrialButton className="shrink-0 rounded-md bg-[#1F4FD0] px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#193FAA]" />
      </div>
    </div>
  )
}

export default function ProductHome() {
  const beta = isBeta()
  const daysLeft = betaDaysLeft()
  const FAQ_ALL = [...FAQ, ...pricingFaq(beta)]
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#14171C] [word-break:keep-all]" style={{ ['--serif' as string]: "'Noto Serif KR', Georgia, serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700&display=swap" />

      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#D9E1EE] bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
          <a href="#top" aria-label={`${PRODUCT.name} 처음으로`}><Logo /></a>
          <nav className="ml-auto hidden items-center gap-7 text-[14px] text-[#5B616B] md:flex" aria-label="소개 메뉴">
            <a href="#multi" className="hover:text-[#0F1115]">여러 매체</a>
            <a href="#team" className="hover:text-[#0F1115]">권한</a>
            <a href="#ai" className="hover:text-[#0F1115]">AI 초안</a>
            <a href="#press" className="hover:text-[#0F1115]">보도자료</a>
            <a href="#support" className="hover:text-[#0F1115]">고객센터</a>
            <a href="#vertical" className="hover:text-[#0F1115]">전문지</a>
            <a href="#showcase" className="hover:text-[#0F1115]">디자인</a>
            <a href="#pricing" className="hover:text-[#0F1115]">요금</a>
            {beta && <a href="#beta" className="hover:text-[#0F1115]">베타 혜택</a>}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link href="/login" className="hidden rounded-md px-3 py-2 text-[13.5px] text-[#5B616B] hover:text-[#0F1115] sm:block">편집국 로그인</Link>
            <a href="#apply" className="hidden rounded-md border border-[#D9E1EE] bg-white px-3.5 py-2 text-[13.5px] font-semibold text-[#14306E] hover:bg-[#EEF3FD] sm:block">서비스 신청</a>
            <TrialButton className="rounded-md bg-[#1F4FD0] px-4 py-2 text-[13.5px] font-bold text-white hover:bg-[#193FAA]">1주일 무료 체험</TrialButton>
          </div>
        </div>
      </header>

      <main id="top">
        {/* ─── 첫 화면 ─── */}
        <section className="relative isolate overflow-hidden bg-white pb-40 pt-32 text-[#0F1115] sm:pt-36">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,#EEF3FD_0%,#FFFFFF_85%)]" aria-hidden />

          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <p className="inline-flex items-center gap-2.5 border-l-2 border-[#E8590C] pl-3 text-[13px] font-medium tracking-[0.02em] text-[#5B616B]">
                {beta ? <>출시 기념 베타 · 1주일 무료 + <b className="font-semibold text-[#C2410C]">{BETA_END_LABEL}까지 반값</b><span className="hidden font-semibold text-[#C2410C] sm:inline"> · D-{daysLeft}</span></> : '지금 가입하면 첫 1주일 무료'}
              </p>
              <h1 className="mt-7 text-[42px] font-extrabold leading-[1.14] tracking-[-0.04em] sm:text-[56px] xl:text-[60px]">
                1인 언론사에도
                <br />
                <span className="text-[#1F4FD0] sm:whitespace-nowrap">뉴스룸이 생깁니다.</span>
              </h1>
              <p className="mt-6 max-w-[32em] text-[17.5px] leading-[1.75] text-[#5B616B]">
                보도자료 수집부터 AI 기사 초안, 승인, 발행, 여러 매체 동시 송고까지.
                반복 업무는 {PRODUCT.name}이 맡고, 기자는 취재와 확인에 집중합니다.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <TrialButton className="rounded-md bg-[#1F4FD0] px-7 py-4 text-[16px] font-bold text-white transition hover:bg-[#193FAA]">
                  1주일 무료 체험 시작 →
                </TrialButton>
                <a href="#apply" className="rounded-md border border-[#D9E1EE] bg-white px-7 py-4 text-[16px] font-semibold text-[#14306E] transition hover:bg-[#EEF3FD]">
                  서비스 신청
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-[#5B616B]">
                <li>✓ 카드 등록 없이 1주일 무료</li>
                <li>✓ 설치 없이 웹에서</li>
                <li>✓ 쓰던 도메인 그대로</li>
                <li>✓ 기존 기사 이전 지원</li>
              </ul>
            </div>

            {/* 기기 구성: 실제 신문 사이트 화면 */}
            <div className="relative mx-auto w-full max-w-[640px] pb-10 lg:pb-0">
              <Browser src={`${IMG}/site-pc.jpg`} alt="IM 뉴스룸으로 만든 신문 사이트 PC 화면 (샘플 기사)" eager className="relative" />
              <Phone src={`${IMG}/site-mobile.jpg`} alt="같은 신문 사이트의 휴대폰 화면" eager className="absolute -bottom-10 -left-4 w-[30%] sm:-left-10 lg:-bottom-16" />
              <div className="pn-float absolute -right-2 -top-6 rounded-xl bg-white px-4 py-3 text-[#14171C] shadow-[0_18px_40px_-16px_rgba(20,48,110,0.35)] ring-1 ring-[#E6EBF3] sm:-right-8">
                <p className="flex items-center gap-2 text-[12px] font-bold"><span className="h-2 w-2 rounded-full bg-[#1F4FD0]" />새 보도자료</p>
                <p className="mt-0.5 text-[22px] font-extrabold tabular-nums">23<span className="text-[13px] font-semibold text-[#8C929B]">건</span></p>
              </div>
              <div className="pn-float absolute -right-3 bottom-8 rounded-xl bg-white px-4 py-3 text-[#14171C] shadow-[0_18px_40px_-16px_rgba(20,48,110,0.35)] ring-1 ring-[#E6EBF3] sm:-right-10" style={{ animationDelay: '1.2s' }}>
                <p className="flex items-center gap-2 text-[12.5px] font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#1F4FD0] text-[9px] text-white">AI</span>기사 초안 완성</p>
                <p className="mt-0.5 text-[11.5px] text-[#5B616B]">확인 메모 2건</p>
              </div>
              <div className="pn-float absolute left-[28%] top-[42%] hidden rounded-xl bg-white px-4 py-3 text-[#14171C] shadow-[0_18px_40px_-16px_rgba(20,48,110,0.35)] ring-1 ring-[#E6EBF3] sm:block" style={{ animationDelay: '2.4s' }}>
                <p className="flex items-center gap-2 text-[12.5px] font-bold"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#3F7D5C] text-[10px] text-white">✓</span>3개 매체 송고 완료</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 숫자 띠 ─── */}
        <section className="relative z-10 -mt-24 px-4 sm:px-6">
          <div className="mx-auto grid max-w-[1100px] grid-cols-2 overflow-hidden rounded-lg bg-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.45)] ring-1 ring-black/5 md:grid-cols-4">
            {[
              { n: 15, s: '곳', label: '보도자료 출처 자동 연결', color: '#0F1115' },
              { n: 30, s: '분', label: '마다 새 보도자료 수집', color: '#0F1115' },
              { n: 0, s: '원', label: '설치비', color: '#0F1115' },
              { n: 1, s: '개', label: '계정으로 여러 매체 운영', color: '#0F1115' },
            ].map((x, i) => (
              <div key={x.label} className={`px-6 py-7 text-center ${i % 2 ? '' : 'border-r'} border-[#EEF0F3] md:border-r md:last:border-r-0 ${i < 2 ? 'border-b md:border-b-0' : ''}`}>
                <p className="text-[38px] font-black tracking-[-0.03em] sm:text-[46px]" style={{ color: x.color }}><CountUp to={x.n} suffix={x.s} /></p>
                <p className="mt-1 text-[13.5px] font-medium text-[#5B616B]">{x.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 흐르는 기능 띠 ─── */}
        <div className="mt-16 overflow-hidden border-y border-[#EEF0F3] py-4" aria-hidden>
          <div className="pn-marquee flex w-max gap-10 text-[15px] font-bold text-[#8C929B]">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="flex items-center gap-10">{m}<span className="text-[#1F4FD0]">·</span></span>
            ))}
          </div>
        </div>

        {/* ─── 함께 송고 ─── */}
        <section id="multi" className="relative isolate scroll-mt-16 overflow-hidden bg-white text-[#0F1115]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
            <Reveal>
              <Eyebrow icon="share" color="#1F4FD0">여러 매체 함께 송고</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>매체가 몇 개든,<br />로그인은 한 번.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#5B616B]">매체마다 CMS를 따로 계약하고 따로 로그인할 필요가 없습니다. 여러 매체를 운영한다면 기사 한 건을 골라서 다른 매체에도 한 번에 올립니다. 사본에는 원본 표시가 붙어 검색엔진이 중복 문서로 보지 않습니다.</p>
              <ul className="mt-7 space-y-3">
                <Check>매체마다 섹션이 달라도 자동으로 맞춰 송고</Check>
                <Check>원본을 고치면 사본에도 반영</Check>
                <Check>본문 바이라인의 매체 이름까지 자동 변경</Check>
              </ul>
            </Reveal>
            <Reveal delay={150}><SyndicateVisual /></Reveal>
          </div>
        </section>

        {/* ─── 그룹·권한 ─── */}
        <section id="team" className="scroll-mt-16 bg-[#F6F8FB]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[0.95fr_1.05fr]">
            <Reveal>
              <Eyebrow icon="users" color="#14306E">그룹 · 권한</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>발행인·편집장·기자,<br />매체마다 다른 직급까지.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#3B4048]">여러 매체를 가진 발행인은 그룹 전체를, 편집장은 자기 매체를, 기자는 자기 기사를 봅니다. 한 사람이 여러 매체에서 일하면 매체마다 직급을 따로 줄 수 있습니다.</p>
              <ul className="mt-7 space-y-3">
                <Check>A매체 편집장 · B매체 기자처럼 매체별 직급, 상단바에서 바로 전환</Check>
                <Check>가입할 때 소속 매체를 고르면 그 매체 발행인이 승인</Check>
                <Check>다른 그룹(다른 언론사)의 회원·기사는 DB에서부터 차단</Check>
                <Check>휴대폰에서도 같은 화면 — 현장에서 쓰고, 이동 중에 승인</Check>
              </ul>
            </Reveal>
            <Reveal delay={150}><TeamMock /></Reveal>
          </div>
        </section>

        {/* ─── AI 초안 ─── */}
        <section id="ai" className="relative isolate scroll-mt-16 overflow-hidden bg-white text-[#0F1115]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="order-2 lg:order-1"><ProofDemo /></Reveal>
            <Reveal delay={150} className="order-1 lg:order-2">
              <Eyebrow icon="spark" color="#1F4FD0">AI 기사 초안</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>AI가 다듬되,<br /><span className="text-[#1F4FD0]">없는 사실은 만들지 않습니다.</span></h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#5B616B]">버튼 한 번이면 AI가 보도자료를 기사체로 다시 씁니다. 그럴듯하게 “고급스럽게 다듬기”보다 중요한 건 오보를 내지 않는 것. 원문에 없는 숫자·인용·인물은 쓰지 않고, 과장이 의심되는 곳은 기자에게 메모로 알려줍니다.</p>
              <ul className="mt-7 space-y-3">
                <Check>원문에 없는 숫자·인용문·인물은 만들지 않음</Check>
                <Check>“업계 최초”, “획기적인” 같은 근거 없는 수식어 제거</Check>
                <Check>확인이 필요한 수치·주장은 “기자 확인 메모”로 표시</Check>
                <Check>초안은 항상 ‘작성중’으로 저장, 사람이 확인 후 발행</Check>
                <Check>제출 전 “AI 검수”로 명예훼손·저작권·개인정보 위험 문장을 찾고, 항목마다 고칠 문장으로 바꾸기/그대로 두기</Check>
                <Check>Gemini 기본·Claude 선택, 한쪽이 막히면 다른 AI가 대신 작성</Check>
                <Check>새 AI는 우리 보도자료로 나란히 비교하고, 기자들이 블라인드로 골라 결정</Check>
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ─── 보도자료함 ─── */}
        <div className="pt-16"><TrialStrip beta={beta} /></div>

        <section id="press" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <Eyebrow icon="inbox" color="#14306E">보도자료함</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>보도자료를 찾으러 다니지 마세요.<br />메일함까지 알아서 모입니다.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#3B4048]">뉴스와이어와 정책브리핑의 보도자료가 30분마다 들어오고, <strong>기자 메일함으로 온 보도자료</strong>도 자동으로 같은 함에 쌓입니다. 우리 매체 분야에 맞는 것만 추천 탭에 뜹니다.</p>
              <ul className="mt-7 space-y-3">
                <Check>지메일 필터 한 번 설정하면 보도자료 메일만 자동 수집 (개인 메일은 제외)</Check>
                <Check>보낸 기관·제목 정리, 첨부 사진은 본문에, 한글·PDF는 내려받기</Check>
                <Check>같은 자료가 여러 기자에게 와도 하나로, 이미 쓴 자료는 “기사화됨” 표시</Check>
                <Check>배포처 약관(하루 사용 건수)까지 화면에서 확인</Check>
              </ul>
              <MailForwardVisual />
            </Reveal>
            <Reveal delay={150}><PressInboxMock /></Reveal>
          </div>
        </section>

        {/* ─── 홈 편집판 + 승인 ─── */}
        <section className="bg-[#F6F8FB]">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal className="order-2 lg:order-1"><HomeBoardMock /></Reveal>
            <Reveal delay={150} className="order-1 lg:order-2">
              <Eyebrow icon="layout" color="#14306E">홈 편집판 · 승인 흐름</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>첫 화면은<br />편집장이 정합니다.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#3B4048]">헤드라인, 톱, 주요 기사, 추천 자리에 어떤 기사를 둘지 고르고 “반영”을 누르면 끝. 비워 둔 자리는 최신 기사로 채워집니다.</p>
              <div className="mt-7 rounded-xl border border-[#E4E6EA] bg-white p-5">
                <p className="text-[13px] font-bold text-[#5B616B]">기자가 쓰고, 편집장이 승인하고</p>
                <div className="mt-3"><ApprovalFlow /></div>
                <p className="mt-3 text-[13.5px] text-[#5B616B]">반려할 때는 사유가 기자에게 그대로 전달됩니다.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ─── 고객센터 ─── */}
        <section id="support" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
            <Reveal>
              <Eyebrow icon="headset" color="#14306E">고객센터 내장</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>요청·공지·청구서까지<br />편집국 화면 안에서.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#3B4048]">
                따로 된 회원사 사이트에 다시 로그인할 필요가 없습니다. 기사를 쓰던 화면의 “고객센터” 메뉴에서 바로 요청하고, 답변이 오면 메뉴에 숫자로 알려드립니다.
              </p>
              <ul className="mt-7 space-y-3">
                <Check>업무요청: 유형 선택·파일 첨부, 접수 → 진행 → 완료 단계 확인</Check>
                <Check>운영팀 공지·업데이트 소식을 뉴스룸 첫 화면에서</Check>
                <Check>월별 청구서를 국내 카드·카카오페이·네이버페이로 바로 결제, 자동결제 등록</Check>
                <Check>업무요청은 매체를 맡은 담당 매니저에게 자동 배정</Check>
                <Check>기자는 본인 요청만, 청구서는 편집장 이상만 보도록 권한 분리</Check>
              </ul>
            </Reveal>
            <Reveal delay={150}><SupportMock /></Reveal>
          </div>
        </section>

        {/* ─── 전문지 맞춤 ─── */}
        <section id="vertical" className="scroll-mt-16">
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal delay={150} className="order-2 lg:order-1">
              <div className="mx-auto grid max-w-[560px] items-start gap-5 sm:grid-cols-[1fr_260px]">
                <div className="rounded-2xl bg-[#0B4D3B] p-6 text-white shadow-[0_30px_70px_-30px_rgba(11,77,59,0.8)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sites/shippingtimes/logo-full-white.svg" alt="Shipping Times 로고" className="h-10 w-auto" />
                  <p className="mt-5 text-[11px] tracking-[0.24em] text-[#D9C08E]">SHIPPING TIMES SPECIAL</p>
                  <p className="mt-1 text-[20px] font-extrabold">국제물류 전문뉴스</p>
                  <ul className="mt-4 grid grid-cols-2 gap-2 text-[12.5px]">
                    {['해운', '물류·포워딩', '항만', '항공화물', '무역·통관', '조선·해양'].map((x) => (
                      <li key={x} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">{x}</li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[11.5px] leading-relaxed text-white/60">보도자료함 추천도 해운·항만·통관 같은 분야 키워드로</p>
                </div>
                <div style={{ ['--brand' as string]: '#0B4D3B', ['--gold' as string]: '#B8975A', ['--gold-ink' as string]: '#78623A', ['--brand-dark' as string]: '#083629' }}>
                  <IndexWidget series={DEMO_INDEX} />
                </div>
              </div>
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <Eyebrow icon="chart" color="#14306E">전문지 맞춤</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>해운지는 해운지답게,<br />의료지는 의료지답게.</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#3B4048]">같은 {PRODUCT.name}이라도 매체마다 로고·색·섹션·첫 화면이 다릅니다. 업계 사람들이 매일 찾아오게 만드는 분야별 위젯도 붙일 수 있습니다.</p>
              <ul className="mt-7 space-y-3">
                <Check>해운 운임지수(SCFI·KCCI) 주간 그래프 — 편집국이 매주 값만 입력</Check>
                <Check>“국제물류 전문뉴스”, “케어 전문뉴스”처럼 매체별 전문 섹션 묶음</Check>
                <Check>분야 키워드로 보도자료 추천, 분야별 보도자료 출처 연결</Check>
                <Check>도메인 연결 전에도 매체마다 따로 된 주소로 미리 확인</Check>
              </ul>
            </Reveal>
          </div>
        </section>

        {/* ─── 완성 화면 ─── */}
        <section id="showcase" className="relative isolate scroll-mt-16 overflow-hidden bg-[#F6F8FB] text-[#0F1115]">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
            <Reveal className="text-center">
              <p className="text-[13px] font-semibold tracking-[0.06em] text-[#1F4FD0]">완성 화면</p>
              <h2 className={`mt-3 ${H2}`}>이런 신문이 만들어집니다</h2>
              <p className="mx-auto mt-4 max-w-[36em] text-[17px] leading-[1.8] text-[#5B616B]">
                저희가 운영하는 보건·복지·요양 전문지 <strong className="text-[#0F1115]">더케어타임즈</strong>의 실제 디자인입니다. 매체 로고와 색을 입혀 우리 신문만의 모습으로 바꿉니다.
              </p>
            </Reveal>
            <Reveal delay={150} className="relative mx-auto mt-14 max-w-[980px]">
              <Browser src={`${IMG}/site-article.jpg`} alt="기사 화면 (샘플 기사)" url="thecaretimes.net/news/…" />
              <Phone src={`${IMG}/site-mobile-menu.jpg`} alt="휴대폰에서 왼쪽에서 열리는 전체 메뉴" className="absolute -bottom-12 -right-2 w-[26%] sm:-right-10" />
            </Reveal>
            <div className="mt-24 grid gap-4 sm:grid-cols-3">
              {[
                { t: 'PC · 휴대폰 자동 대응', d: '한 번 쓰면 두 화면에 맞게' },
                { t: '실시간·많이 본 뉴스', d: '자동으로 채워지는 사이드 영역' },
                { t: '매체 색상·로고 적용', d: '같은 틀, 우리 신문만의 모습' },
              ].map((x, i) => (
                <Reveal key={x.t} delay={i * 100}>
                  <div className="h-full border-t border-[#D9E1EE] pt-5">
                    <p className="text-[16.5px] font-bold">{x.t}</p>
                    <p className="mt-1 text-[14px] text-[#5B616B]">{x.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-center text-[12px] text-[#5B616B]">화면 속 기사와 사진은 레이아웃 확인용 샘플입니다.</p>
          </div>
        </section>

        {/* ─── 작업 순서 ─── */}
        <section>
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
            <Reveal className="text-center">
              <h2 className={H2}>보도자료 한 건이 기사가 되는 길</h2>
              <p className="mx-auto mt-4 max-w-[36em] text-[17px] leading-[1.8] text-[#3B4048]">옮겨 적기, 홍보 문구 걷어내기, 사진 정리는 {PRODUCT.name}이. 판단과 확인은 사람이.</p>
            </Reveal>
            <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 90}>
                  <li className="relative h-full border-t-2 border-[#1F4FD0] pt-5">
                    <p className="text-[42px] font-black leading-none tabular-nums text-[#1F4FD0]">{i + 1}</p>
                    <p className="mt-4 text-[21px] font-extrabold tracking-[-0.02em]">{s.title}</p>
                    <p className="mt-2 text-[14px] leading-[1.7] text-[#5B616B]">{s.body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── 기능 모음 ─── */}
        <section className="bg-[#F6F8FB]">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
            <Reveal className="text-center"><h2 className={H2}>편집국에 필요한 것은 다 있습니다</h2></Reveal>
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 4) * 80}>
                  <div className="group h-full rounded-lg bg-white p-6 ring-1 ring-[#E3E7EE] transition hover:ring-[#1F4FD0]/40">
                    <span className="grid h-11 w-11 place-items-center rounded-md border border-[#E3E7EE] text-[#0F1115] transition group-hover:border-[#1F4FD0] group-hover:text-[#14306E]">
                      <Glyph name={f.icon} className="h-[22px] w-[22px]" />
                    </span>
                    <p className="mt-5 text-[17px] font-bold">{f.title}</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B616B]">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 저희가 먼저 씁니다 ─── */}
        <section>
          <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-24 sm:px-6 md:grid-cols-[1fr_1.2fr]">
            <Reveal>
              <Eyebrow icon="cloud" color="#14306E">직접 운영하며 만듭니다</Eyebrow>
              <h2 className={`mt-5 ${H2}`}>저희 매체가<br />먼저 씁니다.</h2>
            </Reveal>
            <Reveal delay={150}>
              <p className="text-[17px] leading-[1.9] text-[#3B4048]">
                {PRODUCT.name}은 저희가 직접 운영하는 인터넷신문을 위해 만들었습니다. 보건·복지·요양 전문지 <strong>더케어타임즈</strong>를 시작으로, 국제물류 전문지 <strong>Shipping Times</strong>(준비 중) 등 운영 매체를 차례로 옮기고 있습니다.
                매일 쓰면서 불편한 점을 먼저 고치니, 현장에서 필요한 기능이 먼저 들어갑니다.
              </p>
            </Reveal>
          </div>
        </section>

        <div className="py-16"><TrialStrip beta={beta} /></div>

        {/* ─── 요금 ─── */}
        <section id="pricing" className="scroll-mt-16 bg-[#F6F8FB]">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
            <Reveal className="text-center">
              <h2 className={H2}>필요한 건 기본으로, 요금은 가볍게</h2>
              <p className="mx-auto mt-4 max-w-[36em] text-[17px] leading-[1.8] text-[#3B4048]">기자 수는 제한하지 않습니다. AI 사용 횟수(초안·법적 검수)와 용량에 맞춰 고르세요.</p>
            </Reveal>
            <div className="mt-12"><Pricing /></div>
          </div>
        </section>

        {/* ─── 베타 기간: 1주일 무료 → 12월 30일까지 반값 → 2027년 1월 정상가 ─── */}
        {beta && (
          <section id="beta" className="scroll-mt-16 px-4 sm:px-6">
            <Reveal className="relative isolate mx-auto max-w-[1200px] overflow-hidden rounded-xl bg-[#EEF3FD] ring-1 ring-[#D9E1EE] px-6 py-16 text-[#0F1115] sm:px-14">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                  <p className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.06em] text-[#C2410C]"><span className="rounded bg-[#E8590C] px-1.5 py-0.5 text-[11.5px] tracking-normal text-white">D-{daysLeft}</span>출시 기념 베타 · {BETA_END_LABEL} 마감</p>
                  <h2 className="mt-4 text-[32px] font-extrabold leading-[1.25] tracking-[-0.03em] sm:text-[44px]">지금 가입하면<br />첫 1주일은 무료입니다</h2>
                  <p className="mt-4 max-w-[34em] text-[16px] leading-[1.75] text-[#5B616B]">정식 출시 전 베타 기간입니다. {BETA_END_LABEL}까지 가입한 신문사는 12월분까지 모든 요금이 반값이고, {REGULAR_FROM_LABEL}부터 정상가로 바뀝니다.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <TrialButton className="rounded-md bg-[#1F4FD0] px-7 py-4 text-[16px] font-bold text-white transition hover:bg-[#193FAA]" />
                  <a href="#apply" className="rounded-md border border-[#D9E1EE] bg-white px-7 py-4 text-[16px] font-semibold text-[#14306E] transition hover:bg-[#EEF3FD]">서비스 신청</a>
                </div>
              </div>
              <ol className="mt-14 grid gap-8 md:grid-cols-3 md:gap-6">
                {[
                  { when: '가입 후 7일', t: '1주일 무료 체험', d: '카드 등록 없이 모든 기능을 기자·편집장·그룹장으로 써 보기' },
                  { when: `~ 2026년 ${BETA_END_LABEL}`, t: '모든 요금 반값', d: '12월분 이용료까지 반값 · 세팅비 무료 · 기존 기사 이전 지원' },
                  { when: `${REGULAR_FROM_LABEL}부터`, t: '정상가', d: '베이직 월 110,000원부터 (VAT 포함)' },
                ].map((b, i) => (
                  <li key={b.t} className={`border-t-2 pt-5 ${i === 0 ? 'border-[#1F4FD0]' : i === 1 ? 'border-[#E8590C]' : 'border-[#D9E1EE]'}`}>
                    <p className={`text-[12.5px] font-semibold tracking-[0.04em] ${i === 0 ? 'text-[#1F4FD0]' : i === 1 ? 'text-[#C2410C]' : 'text-[#5B616B]'}`}>{b.when}</p>
                    <p className="mt-2 text-[22px] font-extrabold tracking-[-0.02em]">{b.t}</p>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B616B]">{b.d}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </section>
        )}

        {/* ─── 자주 묻는 질문 ─── */}
        <section id="faq" className="scroll-mt-16">
          <div className="mx-auto max-w-[860px] px-4 py-24 sm:px-6">
            <Reveal className="text-center"><h2 className={H2}>자주 묻는 질문</h2></Reveal>
            <div className="mt-10 border-t border-[#E3E7EE]">
              {FAQ_ALL.map((f) => (
                <details key={f.q} className="group border-b border-[#E3E7EE] px-1 py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16.5px] font-bold [&::-webkit-details-marker]:hidden">
                    <span><span className="mr-2 text-[#1F4FD0]">Q.</span>{f.q}</span>
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#F6F8FB] text-[18px] font-normal text-[#5B616B] transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 pl-7 text-[15px] leading-[1.8] text-[#3B4048]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 신청 ─── */}
        <section id="apply" className="relative isolate scroll-mt-16 overflow-hidden bg-[#F6F8FB] text-[#0F1115]">
          <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-24 sm:px-6 md:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className={H2}>서비스 신청</h2>
              <p className="mt-5 text-[17px] leading-[1.8] text-[#5B616B]">
                요금제를 고르고 신청서를 보내주시면 담당자가 연락드려 개통 일정과 계약 서류를 안내합니다. 결제는 계약 내용을 확인한 뒤에 진행되며, 신청만으로는 비용이 생기지 않습니다.
              </p>
              <ul className="mt-8 space-y-3">
                {beta && <Check>{BETA_END_LABEL}까지 신청하면 12월분까지 모든 요금 반값 · 세팅비 무료 ({REGULAR_FROM_LABEL}부터 정상가)</Check>}
                <Check>1년 한 번에 결제하면 {ANNUAL_FREE}</Check>
                <Check>쓰던 도메인 그대로</Check>
                <Check>기존 기사 이전 지원</Check>
              </ul>
              <div className="mt-10 border-t border-[#D9E1EE] pt-6">
                <p className="text-[15px] font-bold">아직 고민 중이라면</p>
                <p className="mt-1 text-[14px] text-[#5B616B]">카드 등록 없이 1주일 동안 모든 기능을 먼저 써 보세요.</p>
                <TrialButton className="mt-4 inline-block rounded-md bg-[#1F4FD0] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#193FAA]" />
              </div>
            </div>
            <div className="text-[#14171C]"><ApplyForm /></div>
          </div>
        </section>
      </main>

      {/* 휴대폰: 화면 아래 고정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D9E1EE] bg-white/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md sm:hidden">
        <TrialButton className="block rounded-md bg-[#1F4FD0] py-3.5 text-center text-[15.5px] font-bold text-white">
          {beta ? `1주일 무료 체험 · ${BETA_END_LABEL}까지 반값` : '1주일 무료 체험 시작'}
        </TrialButton>
      </div>

      <footer className="border-t border-[#D9E1EE] bg-[#F6F8FB] pb-20 text-[#5B616B] sm:pb-0">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-10 text-[13px] sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span>인터넷신문을 위한 AI 편집국</span>
          </div>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-[#0F1115]">편집국 로그인</Link>
            <a href="#apply" className="hover:text-[#0F1115]">서비스 신청</a>
            <Link href={`${PRODUCT.path}/terms`} className="hover:text-[#0F1115]">이용약관</Link>
            <Link href={`${PRODUCT.path}/privacy`} className="font-semibold text-[#5B616B] hover:text-[#0F1115]">개인정보처리방침</Link>
          </div>
          <p className="w-full text-[12px] text-[#5B616B]">© {new Date().getFullYear()} {PRODUCT.nameEn}</p>
        </div>
      </footer>
    </div>
  )
}
