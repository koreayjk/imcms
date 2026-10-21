// IM Newsroom international pricing (USD). Used by the English pages (/imnewsroom/en).
//   Mirrors the Korean price table in lib/pricing.ts: same plans, same limits, same beta window and 1-month-free annual discount.
//   Amounts are final prices. To change a price, edit it here only.
import { BETA_END, BETA_MONTHS, BETA_RATE, ANNUAL_MONTHS, SETUP_WAIVER_MONTHS, addMonth, betaRateFor, isBeta, kstMonth } from './pricing'

export { BETA_END, BETA_MONTHS, ANNUAL_MONTHS, SETUP_WAIVER_MONTHS, isBeta }
export const BETA_END_LABEL_EN = 'October 31, 2026'
export const SETUP_FEE_USD = 110
export const EXTRA_OUTLET_USD = 65
export const EXTRA_AI_USD = 8 // per 100 uses (AI drafts + AI risk reviews combined)

export type PlanIdEn = 'basic' | 'standard' | 'premium' | 'enterprise'
export type BillingEn = 'monthly' | 'annual'

export type PlanEn = {
  id: PlanIdEn
  name: string
  for: string
  monthly: number | null
  pick?: boolean
  specs: [string, string][]
  extras: string[]
}

export const PLANS_EN: PlanEn[] = [
  {
    id: 'basic', name: 'Basic', for: 'A small independent newsroom publishing every day', monthly: 79,
    specs: [['Publications', '1'], ['AI drafts & reviews', '300 / month'], ['Storage (photos + video)', '30 GB'], ['Bandwidth', 'No cap*'], ['Banner & popup design', '3 / month'], ['Newsletter', 'Not included']],
    extras: [],
  },
  {
    id: 'standard', name: 'Standard', for: 'A growing news site with several sections and steady output', monthly: 109, pick: true,
    specs: [['Publications', '1'], ['AI drafts & reviews', '900 / month'], ['Storage (photos + video)', '60 GB'], ['Bandwidth', 'No cap*'], ['Banner & popup design', '5 / month'], ['Newsletter', 'Weekly · 2,000 recipients']],
    extras: ['Homepage customization support'],
  },
  {
    id: 'premium', name: 'Premium', for: 'High-traffic sites and publishers running more than one title', monthly: 169,
    specs: [['Publications', '2 (more available)'], ['AI drafts & reviews', '2,000 / month'], ['Storage (photos + video)', '100 GB'], ['Bandwidth', 'No cap*'], ['Banner & popup design', '10 / month'], ['Newsletter', 'Twice weekly · 5,000 recipients']],
    extras: ['Homepage customization support', 'Group dashboard and one-click publishing to several titles', `3rd title onward: $${EXTRA_OUTLET_USD} / month each (Basic specs)`, 'Priority support'],
  },
  {
    id: 'enterprise', name: 'Enterprise', for: 'Large publishers and networks', monthly: null,
    specs: [['Publications', 'Custom'], ['AI drafts & reviews', 'Custom'], ['Storage (photos + video)', 'Custom'], ['Bandwidth', 'Custom'], ['Banner & popup design', 'By request'], ['Newsletter', 'Custom']],
    extras: ['Dedicated support contact'],
  },
]

export const planEnById = (id: string | null | undefined) => PLANS_EN.find((p) => p.id === id) ?? null

export const usd = (n: number) => { const v = Math.round(n * 100) / 100; return `$${v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}` }

// First billing: plan fee (+ setup fee after the beta window). Annual = 12 months for 11 months' price.
export function firstPaymentUsd(plan: PlanEn, billing: BillingEn, beta = isBeta(), start = kstMonth()) {
  if (plan.monthly == null) return null
  let price: number
  if (billing === 'annual') {
    let sum = 0
    for (let i = 0; i < 12; i++) sum += plan.monthly * betaRateFor(addMonth(start, i), beta, start)
    price = Math.round((sum * ANNUAL_MONTHS) / 12)
  } else {
    price = plan.monthly * betaRateFor(start, beta, start)
  }
  const regular = plan.monthly * (billing === 'annual' ? ANNUAL_MONTHS : 1)
  const setup = beta ? 0 : SETUP_FEE_USD
  return { regular, price, setup, setupFree: beta, total: price + setup }
}
export { BETA_RATE }
