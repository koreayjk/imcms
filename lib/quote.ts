import { PRODUCT } from './product'
import { ANNUAL_MONTHS, BETA_MONTHS, BILLING_LABEL, SETUP_FEE, firstPayment, isBeta, planById, type Billing } from './pricing'

// IM 뉴스룸 이용료 견적서 (신청 접수 메일·소개 페이지에서 링크). 저장하지 않고 주소에 담긴 요금제·결제 방식으로 계산한다
export const quoteUrl = (q: { plan: string; billing: Billing; to?: string }) => {
  const u = new URL(`${PRODUCT.url}${PRODUCT.path}/quote`)
  u.searchParams.set('plan', q.plan)
  u.searchParams.set('billing', q.billing)
  if (q.to) u.searchParams.set('to', q.to.slice(0, 80))
  return u.toString()
}

export type QuoteLine = { name: string; regular: number; price: number; note?: string }
export const QUOTE_VALID_DAYS = 30

export function buildQuote(planId: string, billing: Billing, beta = isBeta()) {
  const plan = planById(planId)
  if (!plan || plan.monthly == null) return null
  const pay = firstPayment(plan, billing, beta)!
  const lines: QuoteLine[] = [
    {
      name: billing === 'annual' ? `${PRODUCT.name} ${plan.name} 1년 이용료 (12개월을 ${ANNUAL_MONTHS}개월 값으로)` : `${PRODUCT.name} ${plan.name} 월 이용료 (첫 달)`,
      regular: pay.regular,
      price: pay.price,
      note: pay.price < pay.regular ? `베타 기간 신청: ${billing === 'annual' ? `12개월 중 첫 ${BETA_MONTHS}개월분` : `첫 ${BETA_MONTHS}개월`} 반값` : undefined,
    },
    { name: '세팅비 (처음 개통할 때 한 번)', regular: SETUP_FEE, price: pay.setup, note: pay.setupFree ? '베타 기간 신청: 무료 (개통 후 3개월 이상 이용 조건)' : undefined },
  ]
  // 그다음부터 내는 금액 (베타 할인이 끝난 정상가)
  const after = billing === 'annual' ? { label: '다음 해부터 1년마다', amount: plan.monthly * ANNUAL_MONTHS } : { label: '할인 기간이 끝난 뒤 매월', amount: plan.monthly }
  return { plan, billing, billingLabel: BILLING_LABEL[billing], lines, total: pay.total, regularTotal: pay.regular + SETUP_FEE, after, beta }
}
