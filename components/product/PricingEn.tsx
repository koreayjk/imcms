'use client'

import { useState } from 'react'
import { ANNUAL_MONTHS, BETA_END_LABEL_EN, BETA_MONTHS, EXTRA_AI_USD, EXTRA_OUTLET_USD, PLANS_EN, SETUP_FEE_USD, SETUP_WAIVER_MONTHS, firstPaymentUsd, isBeta, usd, type BillingEn, type PlanIdEn } from '@/lib/pricing-global'
import { PICK_PLAN_EVENT_EN, type PickPlanDetailEn } from './ApplyFormEn'

export default function PricingEn() {
  const [billing, setBilling] = useState<BillingEn>('monthly')
  const beta = isBeta()
  const pick = (plan: PlanIdEn) => {
    window.dispatchEvent(new CustomEvent<PickPlanDetailEn>(PICK_PLAN_EVENT_EN, { detail: { plan, billing } }))
    document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <section id="pricing" className="scroll-mt-16 bg-[#F7F8FA]">
      <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:py-28">
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-[0.06em] text-[#1D3461]">PRICING</p>
          <h2 className="mt-3 text-[30px] font-extrabold leading-[1.18] tracking-[-0.035em] [text-wrap:balance] sm:text-[42px]">Simple plans in US dollars</h2>
          <p className="mx-auto mt-4 max-w-[36em] text-[16.5px] leading-[1.75] text-[#5B616B]">Unlimited reporter and editor accounts on every plan. Prices are final: no hidden per-seat fees.</p>
          <div role="group" aria-label="Billing" className="mx-auto mt-7 inline-grid grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-black/5">
            {(['monthly', 'annual'] as BillingEn[]).map((b) => (
              <button key={b} type="button" aria-pressed={billing === b} onClick={() => setBilling(b)} className={`rounded-full px-5 py-2 text-[14px] font-bold transition ${billing === b ? 'bg-[#1D3461] text-white' : 'text-[#3B4048]'}`}>
                {b === 'monthly' ? 'Monthly' : <>Annual <span className="ml-1 text-[11.5px] font-semibold opacity-80">1 month free</span></>}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS_EN.map((p) => {
            const pay = firstPaymentUsd(p, billing)
            const perMonth = p.monthly == null ? null : billing === 'annual' ? Math.round((p.monthly * ANNUAL_MONTHS) / 12) : p.monthly
            return (
              <li key={p.id} className={`relative flex flex-col rounded-2xl bg-white p-6 ring-1 ${p.pick ? 'ring-2 ring-[#1D3461]' : 'ring-black/5'}`}>
                {p.pick && <span className="absolute -top-3 left-6 rounded-full bg-[#C2410C] px-2.5 py-0.5 text-[11px] font-bold text-white">Most popular</span>}
                <p className="text-[18px] font-extrabold">{p.name}</p>
                <p className="mt-1 min-h-[3.2em] text-[13.5px] leading-[1.6] text-[#5B616B]">{p.for}</p>
                <p className="mt-4">
                  {perMonth == null ? <span className="text-[28px] font-extrabold tracking-[-0.03em]">Custom</span> : (
                    <>
                      <span className="text-[34px] font-extrabold tabular-nums tracking-[-0.04em]">{usd(perMonth)}</span>
                      <span className="text-[14px] text-[#5B616B]"> / month{billing === 'annual' ? ', billed yearly' : ''}</span>
                    </>
                  )}
                </p>
                {pay && beta && <p className="mt-1 text-[12.5px] font-semibold text-[#C2410C]">First {BETA_MONTHS} months 50% off · first payment {usd(pay.total)}</p>}
                <ul className="mt-5 space-y-2 border-t border-[#EEF0F3] pt-5 text-[13.5px]">
                  {p.specs.map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span className="text-[#5B616B]">{k}</span><span className="text-right font-semibold">{v}</span></li>)}
                  {p.extras.map((x) => <li key={x} className="text-[#3B4048]">✓ {x}</li>)}
                </ul>
                <button type="button" onClick={() => pick(p.id)} className={`mt-6 rounded-full px-5 py-3 text-[14.5px] font-bold transition ${p.pick ? 'bg-[#1D3461] text-white hover:bg-[#152748]' : 'bg-[#F1F3F7] text-[#16294D] hover:bg-[#E6EAF2]'}`}>
                  {p.monthly == null ? 'Talk to us' : 'Choose ' + p.name}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-[16px] font-extrabold">Setup fee · one time</h3>
              <p className="mt-1 max-w-[40em] text-[13.5px] leading-[1.7] text-[#5B616B]">We open your newsroom and site, apply your branding and homepage layout, add legal and footer pages, connect your domain, help move your archive and onboard your team one-on-one.</p>
            </div>
            <p className="tabular-nums">
              {beta && <span className="mr-2 text-[15px] text-[#9AA0A8]"><s>{usd(SETUP_FEE_USD)}</s></span>}
              <span className="text-[26px] font-extrabold tracking-[-0.02em]">{beta ? '$0' : usd(SETUP_FEE_USD)}</span>
              {beta && <span className="ml-2 inline-block rounded bg-[#FFF3EB] px-2 py-0.5 align-[4px] text-[12px] font-bold text-[#C2410C]">Waived if you apply by {BETA_END_LABEL_EN}</span>}
            </p>
          </div>
          <p className="mt-4 text-[12.5px] leading-[1.7] text-[#8A9099]">
            {beta ? `The setup-fee waiver assumes you stay at least ${SETUP_WAIVER_MONTHS} months after launch; if you cancel sooner, we charge the waived fee. ` : ''}
            Extra title (3rd onward on Premium): {usd(EXTRA_OUTLET_USD)} / month each. Extra AI usage: {usd(EXTRA_AI_USD)} per 100 uses. *Bandwidth is not capped for normal newsroom use.
          </p>
        </div>
      </div>
    </section>
  )
}
