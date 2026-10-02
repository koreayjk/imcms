// IM 뉴스룸 요금 (소개 페이지 요금표·신청서·고객 상담 화면이 같이 쓴다). 금액은 모두 VAT 포함
//   1년 한 번에 결제하면 2개월 무료(10개월 값), 베타 테스트 신문사는 반값 — 두 혜택은 함께 적용된다
//   베타 모집이 끝나면 BETA 를 false 로 바꾸면 반값 표시·계산이 모두 빠진다
export const BETA = true
export const BETA_RATE = 0.5
export const ANNUAL_MONTHS = 10
export const SETUP_FEE = 110_000
export const EXTRA_OUTLET_FEE = 33_000
export const EXTRA_AI_FEE = 11_000 // 100건마다

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
    monthly: 77_000,
    specs: [['AI 기사 초안', '월 100건'], ['저장 용량', '30G'], ['월 전송량', '300G'], ['업무요청', '50pt']],
    extras: [],
  },
  {
    id: 'standard',
    name: '스탠다드',
    for: '섹션이 많고 기사량이 꾸준한 일반 언론사',
    monthly: 154_000,
    pick: true,
    specs: [['AI 기사 초안', '월 300건'], ['저장 용량', '60G'], ['월 전송량', '500G'], ['업무요청', '100pt']],
    extras: ['홈페이지 맞춤 수정 지원'],
  },
  {
    id: 'premium',
    name: '프리미엄',
    for: '방문자가 많거나 매체를 여럿 운영하는 언론사',
    monthly: 231_000,
    specs: [['AI 기사 초안', '월 1,000건'], ['저장 용량', '100G'], ['월 전송량', '1,000G'], ['업무요청', '200pt']],
    extras: ['홈페이지 맞춤 수정 지원', '같은 그룹 매체 3개까지 포함', '우선 지원'],
  },
  {
    id: 'enterprise',
    name: '엔터프라이즈',
    for: '방문자·기사량이 아주 많은 중대형 언론사',
    monthly: null,
    specs: [['AI 기사 초안', '맞춤'], ['저장 용량', '맞춤'], ['월 전송량', '맞춤'], ['업무요청', '상담']],
    extras: ['전용 지원 담당'],
  },
]

export const planById = (id: string | null | undefined) => PLANS.find((p) => p.id === id) ?? null
export const BILLING_LABEL: Record<Billing, string> = { monthly: '월 결제', annual: '1년 결제' }

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

// 한 번 결제하는 이용료 (월 결제면 한 달, 1년 결제면 10개월 값). 별도 문의 요금제는 null
export function planCharge(plan: Plan, billing: Billing, beta = BETA) {
  if (plan.monthly == null) return null
  const regular = plan.monthly * (billing === 'annual' ? ANNUAL_MONTHS : 1)
  return { regular, price: regular * (beta ? BETA_RATE : 1) }
}

// 신청서의 첫 결제 금액: 이용료 + 세팅비 (베타 신문사·다른 프로그램에서 옮겨 오는 곳은 세팅비 무료)
export function firstPayment(plan: Plan, billing: Billing, migrating: boolean, beta = BETA) {
  const charge = planCharge(plan, billing, beta)
  if (!charge) return null
  const setupFree = beta || migrating
  const setup = setupFree ? 0 : SETUP_FEE
  return { ...charge, setup, setupFree, total: charge.price + setup }
}

// 다른 프로그램에서 옮겨 오는지 (세팅비 무료 판단): 쓰는 프로그램을 적었고 “없음”이 아니면
export function isMigrating(currentCms: string) {
  const v = currentCms.trim()
  return !!v && !/^(없음|없다|없어요|x|-|창간\s*준비)/i.test(v)
}
