import type { SupabaseClient } from '@supabase/supabase-js'
import { ANNUAL_MONTHS, EXTRA_AI_FEE, EXTRA_OUTLET_FEE, SETUP_FEE, BETA_LAST_MONTH, annualPrice, betaRateFor, planById } from './pricing'
import { invoiceTotals, type InvoiceItem } from './support'
import { paymentDbSecret } from './toss'
import { notifyInvoiceIssued } from './invoice-mail'

// 매월 자동 청구서 (supabase/billing-auto.sql). 금액은 모두 VAT 포함
//   매월 1일 발행 · 10일 납부. 1년 결제는 시작 월부터 12개월마다 한 번(11개월 값)
//   항목: 요금제 이용료(베타 반값) · 추가 매체 · 지난달 AI 추가 사용(100회마다) · 세팅비(처음 한 번)

export type BillingChild = { outlet_id: string; name: string; over_count: number }
export type BillingTarget = {
  outlet_id: string
  name: string
  plan: string | null
  cycle: 'monthly' | 'annual'
  beta: boolean
  start_month: string | null
  setup_fee_pending: boolean
  custom_monthly: number | null
  has_invoice: boolean
  over_count: number
  autopay: { card_company: string | null; card_number: string | null } | null
  children: BillingChild[]
}

export const DUE_DAY = 10
export const PREMIUM_INCLUDED_EXTRA = 2

const ym = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1
const label = (n: number) => `${Math.floor(n / 12)}년 ${(n % 12) + 1}월`
const aiQty = (over: number) => Math.ceil(over / 100)

// 한국 날짜 'YYYY-MM-DD'
export function kstToday() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
}

// 이번 청구서에 들어갈 항목. month = 'YYYY-MM'
export function billingItems(t: BillingTarget, month: string) {
  const items: InvoiceItem[] = []
  const m = ym(`${month}-01`)
  const plan = planById(t.plan)
  const monthly = t.custom_monthly ?? plan?.monthly ?? null
  const planName = t.custom_monthly != null ? '이용료' : plan ? `${plan.name} 요금제` : null
  // 맞춤 금액은 그대로, 요금제 금액에만 베타 반값 (2026년 12월분까지, 2027년 1월분부터 정상가)
  const beta = t.beta && t.custom_monthly == null
  const rate = betaRateFor(month, beta)
  const betaTag = rate < 1 ? ', 베타 반값' : ''
  // 1년 결제는 12개월 중 12월분까지만 반값
  const annualBeta = beta && month <= BETA_LAST_MONTH ? ', 2026년 12월분까지 베타 반값' : ''

  const annual = t.cycle === 'annual'
  // 1년 결제: 시작 월에서 12개월마다만 이용료를 청구 (시작 월이 없으면 이용료는 넣지 않는다)
  const billPlan = !annual || (t.start_month != null && (m - ym(t.start_month)) % 12 === 0 && m >= ym(t.start_month))
  if (billPlan) {
    if (monthly != null && planName) {
      items.push(annual
        ? { name: `IM 뉴스룸 ${planName} 1년 (${label(m)}~${label(m + 11)}, ${ANNUAL_MONTHS}개월 값${annualBeta})`, qty: 1, unit_price: annualPrice(monthly, month, beta) }
        : { name: `IM 뉴스룸 ${planName} (${label(m)}${betaTag})`, qty: 1, unit_price: Math.round(monthly * rate) })
    }
    // 프리미엄은 같은 그룹 매체 3개까지 포함 (본 매체 + 추가 2개는 무료)
    const included = t.plan === 'premium' && t.custom_monthly == null ? PREMIUM_INCLUDED_EXTRA : 0
    for (const c of t.children.slice(included)) {
      items.push(annual
        ? { name: `추가 매체 · ${c.name} (1년, ${ANNUAL_MONTHS}개월 값)`, qty: 1, unit_price: EXTRA_OUTLET_FEE * ANNUAL_MONTHS }
        : { name: `추가 매체 · ${c.name}`, qty: 1, unit_price: EXTRA_OUTLET_FEE })
    }
  }

  // 지난달 AI 추가 사용 (한도를 넘겨 쓴 횟수, 100회마다)
  const prev = label(m - 1)
  const ai = [{ name: t.name, over: t.over_count, self: true }, ...t.children.map((c) => ({ name: c.name, over: c.over_count, self: false }))]
  for (const a of ai) {
    if (a.over > 0) items.push({ name: `AI 추가 사용${a.self ? '' : ` · ${a.name}`} (${prev} ${a.over.toLocaleString('ko-KR')}회, 100회마다)`, qty: aiQty(a.over), unit_price: EXTRA_AI_FEE })
  }

  const setup = t.setup_fee_pending
  if (setup) items.push({ name: '세팅비 (처음 한 번)', qty: 1, unit_price: SETUP_FEE })
  return { items, totals: invoiceTotals(items), clearSetup: setup }
}

// 납부 기한: 그달 10일. 10일이 얼마 안 남았거나 지났으면(늦게 켠 경우) 오늘부터 7일 뒤
export function dueDate(month: string, today = kstToday()) {
  const tenth = `${month}-${String(DUE_DAY).padStart(2, '0')}`
  const minDue = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10)
  return tenth >= minDue ? tenth : minDue
}

export async function billingTargets(supabase: SupabaseClient, month: string) {
  const { data, error } = await supabase.rpc('billing_targets', { secret: paymentDbSecret(), p_month: `${month}-01` })
  if (error) throw new Error(error.message)
  return (data ?? []) as BillingTarget[]
}

// 이번 달 청구서 만들기 (이미 있는 매체는 건너뛴다). 만든 청구서마다 안내 메일
//   deadline(시각, ms)을 넘기면 멈추고 남은 매체 수를 pending 으로 돌려준다 → 예약 작업이 몇 분 뒤 다시 불러 이어서 만든다
export async function runBilling(supabase: SupabaseClient, month: string, origin: string, deadline = Number.POSITIVE_INFINITY) {
  const targets = await billingTargets(supabase, month)
  const created: { outlet: string; id: string; total: number }[] = []
  const skipped: { outlet: string; reason: string }[] = []
  const due = dueDate(month)
  let pending = 0
  for (const t of targets) {
    if (Date.now() > deadline) { if (!t.has_invoice) pending++; continue }
    if (t.has_invoice) { skipped.push({ outlet: t.name, reason: '이번 달 청구서가 이미 있음' }); continue }
    const { items, totals, clearSetup } = billingItems(t, month)
    if (!items.length || totals.total <= 0) { skipped.push({ outlet: t.name, reason: '청구할 항목 없음' }); continue }
    const { data: id, error } = await supabase.rpc('billing_create', {
      secret: paymentDbSecret(), o: t.outlet_id, p_month: `${month}-01`, p_items: items,
      p_supply: totals.supply, p_vat: totals.vat, p_total: totals.total, p_due: due,
      p_memo: '매월 자동으로 발행된 청구서입니다. 금액은 부가세 포함입니다.', p_clear_setup: clearSetup,
    })
    if (error) { skipped.push({ outlet: t.name, reason: error.message }); continue }
    if (!id) { skipped.push({ outlet: t.name, reason: '이번 달 청구서가 이미 있음' }); continue }
    created.push({ outlet: t.name, id: id as string, total: totals.total })
    await notifyInvoiceIssued(supabase, {
      id: id as string, outletName: t.name, month: `${month}-01`, total: totals.total, dueDate: due,
      createdAt: new Date().toISOString(), autopay: t.autopay, origin,
    })
  }
  return { created, skipped, pending }
}
