// IM 뉴스룸 요금 (소개 페이지 요금표·신청서·고객 상담 화면이 같이 쓴다). 금액은 모두 최종 금액 (미국 법인 공급이라 한국 부가세 없음)
//   1년 한 번에 결제하면 1개월 무료(11개월 값), 베타 테스트 신문사는 반값 — 두 혜택은 함께 적용된다
//   베타(출시 전 테스트): 2026년 10월 31일(한국 시간)까지 가입·신청한 신문사는 첫 3개월(첫 청구 월부터 3개월분) 이용료 반값,
//   4개월째부터 정상가. 마감일이 지나면 소개 페이지의 반값 표시·계산이 저절로 빠진다 (연장하려면 BETA_END 만 바꾼다)
export const BETA_END = '2026-10-31'
export const BETA_END_LABEL = '10월 31일'
export const BETA_MONTHS = 3
export const BETA_PERIOD_LABEL = `첫 ${BETA_MONTHS}개월`
export const REGULAR_AFTER_LABEL = `${BETA_MONTHS + 1}개월째부터`
export const BETA_RATE = 0.5
export const ANNUAL_MONTHS = 11

const kstDate = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10)
export const kstMonth = (d = new Date()) => kstDate(d).slice(0, 7)
// 지금 베타 기간인지 (한국 날짜 기준)
export const isBeta = (d = new Date()) => kstDate(d) <= BETA_END
// 베타 마감까지 남은 날 (마감일 당일 = 1, 지나면 0)
export function betaDaysLeft(d = new Date()) {
  return Math.max(0, Math.ceil((Date.parse(`${BETA_END}T23:59:59+09:00`) - d.getTime()) / 86_400_000))
}
export function addMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
// 그 달 이용료에 곱할 값: 베타 고객이고 첫 청구 월(start, 'YYYY-MM')부터 3개월 안이면 반값
export const betaRateFor = (month: string, beta: boolean, start: string | null | undefined) =>
  (beta && start && month >= start && month < addMonth(start, BETA_MONTHS) ? BETA_RATE : 1)
// 1년 결제: 12개월을 달마다(첫 3개월 반값, 그다음 정상가) 더한 뒤 1개월 무료(11/12). 10원 단위
export function annualPrice(monthly: number, start: string, beta: boolean) {
  let sum = 0
  for (let i = 0; i < 12; i++) sum += monthly * betaRateFor(addMonth(start, i), beta, start)
  return Math.round((sum * ANNUAL_MONTHS) / 12 / 10) * 10
}
// 1년 결제 혜택 표시 ("1개월 무료")
export const ANNUAL_FREE = `${12 - ANNUAL_MONTHS}개월 무료`
export const SETUP_FEE = 150_000

// 세팅비(처음 한 번)에 들어가는 일 — 소개 페이지 요금표에 그대로 보여준다
export const SETUP_ITEMS: [string, string][] = [
  ['편집국·홈페이지 개설', '매체 등록, 섹션(메뉴) 구성, 기자·편집장 계정 초대와 직급 설정'],
  ['홈페이지 맞춤 적용', '로고·대표 색·슬로건, 첫 화면 배치와 전문 섹션 구성'],
  ['법정 표기·정책 페이지', '등록번호·발행인·편집인 등 하단 표기, 개인정보처리방침·청소년보호정책'],
  ['도메인 연결', '쓰던 도메인 연결과 보안 접속(https) 적용'],
  ['기존 기사 옮기기', '다른 프로그램의 기사·사진 이전과 옛 기사 주소 자동 연결 (검색 노출 유지)'],
  ['포털 검색 등록 준비', '사이트맵·RSS 생성, 네이버·구글 소유 확인 연결'],
  ['사용법 안내', '기사 쓰기·승인·홈 편집·보도자료·AI 초안 사용법 1:1 안내'],
]
// 매체 추가: 프리미엄 전용. 프리미엄은 추가 매체 1개 포함(매체 2개), 그다음부터 매체마다.
//   추가 매체는 베이직 사양 (AI 월 300회·뉴스레터 회당 2,000명 등, extra-outlet-basic.sql)
export const EXTRA_OUTLET_FEE = 90_000
export const PREMIUM_INCLUDED_EXTRA = 1
export const EXTRA_AI_FEE = 11_000 // 100회마다 (AI 초안·법적 검수 합계)

export type PlanId = 'basic' | 'standard' | 'premium' | 'enterprise'
export type Billing = 'monthly' | 'annual'

export type Plan = {
  id: PlanId
  name: string
  for: string
  monthly: number | null
  pick?: boolean
  specs: [string, string][]
  extras: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'basic',
    name: '베이직',
    for: '기자 몇 명이 매일 기사를 내는 소규모 인터넷신문',
    monthly: 110_000,
    specs: [['운영 매체', '1개'], ['AI 초안·법적 검수', '월 300회'], ['저장 용량', '30G'], ['전송량', '제한 없음*'], ['배너·팝업 디자인', '월 3건'], ['뉴스레터', '회당 2,000명']],
    extras: [],
  },
  {
    id: 'standard',
    name: '스탠다드',
    for: '섹션이 많고 기사량이 꾸준한 일반 언론사',
    monthly: 150_000,
    pick: true,
    specs: [['운영 매체', '1개'], ['AI 초안·법적 검수', '월 900회'], ['저장 용량', '60G'], ['전송량', '제한 없음*'], ['배너·팝업 디자인', '월 5건'], ['뉴스레터', '회당 2,000명']],
    extras: ['홈페이지 맞춤 수정 지원'],
  },
  {
    id: 'premium',
    name: '프리미엄',
    for: '방문자가 많거나 매체를 여럿 운영하는 언론사',
    monthly: 230_000,
    specs: [['운영 매체', '2개 (추가 가능)'], ['AI 초안·법적 검수', '월 2,000회'], ['저장 용량', '100G'], ['전송량', '제한 없음*'], ['배너·팝업 디자인', '월 10건'], ['뉴스레터', '회당 10,000명']],
    extras: ['홈페이지 맞춤 수정 지원', '그룹장 화면 · 여러 매체 동시 송고', '3번째 매체부터 매체마다 월 90,000원 (베이직 사양)', '우선 지원'],
  },
  {
    id: 'enterprise',
    name: '엔터프라이즈',
    for: '방문자·기사량이 아주 많은 중대형 언론사',
    monthly: null,
    specs: [['운영 매체', '맞춤'], ['AI 초안·법적 검수', '맞춤'], ['저장 용량', '맞춤'], ['전송량', '맞춤'], ['배너·팝업 디자인', '상담'], ['뉴스레터', '맞춤']],
    extras: ['전용 지원 담당'],
  },
]

export const planById = (id: string | null | undefined) => PLANS.find((p) => p.id === id) ?? null

// 뉴스레터 한 번에 보낼 수 있는 인원 (요금제 없음 = 운영사 자체 매체는 넉넉히)
export function newsletterLimit(plan: string | null | undefined) {
  if (plan === 'premium' || plan === 'enterprise' || !plan) return 10_000
  return 2_000
}
export const BILLING_LABEL: Record<Billing, string> = { monthly: '월 결제', annual: '1년 결제' }

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

// 한 번 결제하는 이용료 (월 결제면 한 달, 1년 결제면 11개월 값). 별도 문의 요금제는 null
//   start: 첫 이용 월('YYYY-MM', 기본은 이번 달)
export function planCharge(plan: Plan, billing: Billing, beta = isBeta(), start = kstMonth()) {
  if (plan.monthly == null) return null
  const regular = plan.monthly * (billing === 'annual' ? ANNUAL_MONTHS : 1)
  const price = billing === 'annual' ? annualPrice(plan.monthly, start, beta) : plan.monthly * betaRateFor(start, beta, start)
  return { regular, price }
}

// 신청서의 첫 결제 금액: 이용료 + 세팅비 (베타 기간에 신청하면 세팅비 무료)
export function firstPayment(plan: Plan, billing: Billing, beta = isBeta()) {
  const charge = planCharge(plan, billing, beta)
  if (!charge) return null
  const setupFree = beta
  const setup = setupFree ? 0 : SETUP_FEE
  return { ...charge, setup, setupFree, total: charge.price + setup }
}

