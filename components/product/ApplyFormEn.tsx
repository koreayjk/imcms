'use client'

import { useEffect, useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitApplicationEn, type ApplyStateEn } from '@/app/imnewsroom/en/actions'
import { ANNUAL_MONTHS, BETA_END_LABEL_EN, BETA_MONTHS, PLANS_EN, SETUP_FEE_USD, SETUP_WAIVER_MONTHS, firstPaymentUsd, isBeta, planEnById, usd, type BillingEn, type PlanIdEn } from '@/lib/pricing-global'
import { applyConsentSectionsEn } from '@/lib/service-terms-en'
import PolicyDoc from './PolicyDoc'
import { LAYOUTS_EN, demoUrlEn } from '@/lib/home-layouts-en'

export const PICK_PLAN_EVENT_EN = 'pn:pick-plan-en'
export type PickPlanDetailEn = { plan?: PlanIdEn; billing?: BillingEn }

const input = 'w-full rounded-md border border-[#D5D8DD] bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-[#A3A8B0] focus:border-[#1D3461]'

function Field({ id, label, required, children, hint }: { id: string; label: string; required?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-[#14171C]">{label} {required && <span className="text-[#D6402B]">*</span>}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] leading-snug text-[#5B616B]">{hint}</p>}
    </div>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="w-full rounded-md bg-[#1D3461] px-5 py-4 text-[16px] font-bold text-white transition hover:bg-[#152748] disabled:opacity-60">{pending ? 'Sending…' : 'Submit application'}</button>
}

export default function ApplyFormEn() {
  const [state, action] = useActionState<ApplyStateEn, FormData>(submitApplicationEn, {})
  const [plan, setPlan] = useState<PlanIdEn>('standard')
  const [billing, setBilling] = useState<BillingEn>('monthly')
  const [design, setDesign] = useState('')
  const [agree, setAgree] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<PickPlanDetailEn>).detail
      if (d?.plan) setPlan(d.plan)
      if (d?.billing) setBilling(d.billing)
    }
    window.addEventListener(PICK_PLAN_EVENT_EN, on)
    return () => window.removeEventListener(PICK_PLAN_EVENT_EN, on)
  }, [])

  const chosen = planEnById(plan)!
  const pay = firstPaymentUsd(chosen, billing)
  const BETA = isBeta()

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-[#14171C] bg-white px-6 py-10 text-center">
        <p className="text-[18px] font-bold">We received your application</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#5B616B]">
          {chosen.name} · {billing === 'annual' ? 'Annual' : 'Monthly'}{pay ? ` · First payment ${usd(pay.total)}` : ''}
          <br />We&apos;ll email you within 2 business days to schedule your launch and walk you through the contract.
          <br />Nothing is charged yet. Check your spam folder if you don&apos;t see our confirmation.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-7 rounded-lg border border-[#E4E6EA] bg-white p-6 sm:p-8" noValidate>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="billing" value={billing} />
      <input type="hidden" name="design" value={design} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-[#14171C]">Plan <span className="text-[#D6402B]">*</span></legend>
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
          {PLANS_EN.map((p) => (
            <label key={p.id} className={`relative cursor-pointer rounded-md border px-3 py-2.5 text-center transition ${plan === p.id ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
              <input type="radio" name="plan_pick" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
              {p.pick && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#C2410C] px-2 py-0.5 text-[10.5px] font-bold text-white">Most popular</span>}
              <span className="block text-[14.5px] font-bold">{p.name}</span>
              <span className="block text-[12px] tabular-nums text-[#5B616B]">{p.monthly == null ? 'Contact us' : `${usd(p.monthly)} / month`}</span>
            </label>
          ))}
        </div>
        {chosen.monthly != null && (
          <div role="group" aria-label="Billing" className="mt-2 grid grid-cols-2 gap-2">
            {(['monthly', 'annual'] as BillingEn[]).map((b) => (
              <button key={b} type="button" aria-pressed={billing === b} onClick={() => setBilling(b)}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-[14px] font-semibold transition ${billing === b ? 'border-[#1D3461] bg-[#1D3461] text-white' : 'border-[#D5D8DD] text-[#3B4048] hover:border-[#1D3461]'}`}>
                {b === 'monthly' ? 'Monthly' : 'Annual'}
                {b === 'annual' && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${billing === b ? 'bg-white/90 text-[#16294D]' : 'bg-[#EFF2F7] text-[#16294D]'}`}>1 month free</span>}
              </button>
            ))}
          </div>
        )}
        <div aria-live="polite" className="mt-3 rounded-md bg-[#F4F5F7] px-4 py-3.5">
          {pay ? (
            <>
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#5B616B]">First payment (USD, all-in)</span>
                <span className="text-[24px] font-extrabold tabular-nums tracking-[-0.02em] text-[#16294D]">{usd(pay.total)}</span>
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px] tabular-nums text-[#5B616B]">
                <li>
                  Plan fee {usd(pay.price)} ({chosen.name} · {billing === 'annual' ? `12 months for the price of ${ANNUAL_MONTHS}` : '1 month'}{BETA && <b className="font-semibold text-[#C2410C]"> · beta 50% off first {BETA_MONTHS} months</b>})
                  {BETA && <s className="ml-1 text-[#9AA0A8]">{usd(pay.regular)}</s>}
                </li>
                <li>Setup fee {pay.setupFree ? <>$0 <s className="text-[#9AA0A8]">{usd(SETUP_FEE_USD)}</s> <b className="font-semibold text-[#C2410C]">(waived for applications by {BETA_END_LABEL_EN} · requires {SETUP_WAIVER_MONTHS}+ months of use)</b></> : <>{usd(pay.setup)} (one time)</>}</li>
              </ul>
              <p className="mt-2 text-[12px] text-[#5B616B]">Nothing is charged when you apply. We invoice only after you confirm the contract.</p>
            </>
          ) : (
            <p className="text-[13.5px] text-[#3B4048]">Enterprise is quoted after we learn about your traffic and requirements.</p>
          )}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company" label="Publication name" required><input id="company" name="company" required maxLength={80} placeholder="Planned name is fine" className={input} /></Field>
        <Field id="contact_name" label="Your name" required><input id="contact_name" name="contact_name" required maxLength={40} autoComplete="name" className={input} /></Field>
        <Field id="email" label="Email" required hint="For invoices and onboarding"><input id="email" name="email" required type="email" maxLength={120} autoComplete="email" className={input} /></Field>
        <Field id="phone" label="Phone" hint="Optional"><input id="phone" name="phone" type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="+1 555 000 0000" className={input} /></Field>
        <Field id="country" label="Country" required><input id="country" name="country" required maxLength={60} autoComplete="country-name" className={input} /></Field>
        <Field id="domain" label="Domain" hint="Leave blank if you don't have one yet. We can help you choose one."><input id="domain" name="domain" maxLength={120} inputMode="url" placeholder="mynews.com" className={input} /></Field>
        <Field id="outlet_count" label="How many titles do you run?">
          <select id="outlet_count" name="outlet_count" defaultValue="" className={input}>
            <option value="">Select</option><option>Launching soon</option><option>1</option><option>2-5</option><option>6+</option>
          </select>
        </Field>
        <Field id="current_cms" label="Current CMS" hint="If you're moving from another system we'll help move your articles and old URLs."><input id="current_cms" name="current_cms" maxLength={80} placeholder="None / WordPress / …" className={input} /></Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-[#14171C]">Homepage layout <span className="font-normal text-[#5B616B]">(optional)</span></legend>
        <p className="mb-2.5 text-[12.5px] leading-[1.6] text-[#5B616B]">Pick the look you like. You can change it anytime after launch.</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {LAYOUTS_EN.map((l) => (
            <label key={l.key} className={`flex cursor-pointer flex-col gap-2 rounded-md border p-2.5 transition ${design === l.key ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/designs-en/${l.key}.webp`} width={800} height={600} loading="lazy" alt={`${l.name} homepage layout`} className="aspect-[4/3] w-full rounded object-cover object-top ring-1 ring-black/10" />
              <span className="flex items-start gap-2">
                <input type="radio" name="design_pick" value={l.key} checked={design === l.key} onChange={() => setDesign(l.key)} className="mt-1 accent-[#1D3461]" />
                <span className="min-w-0 flex-1 leading-tight"><span className="block text-[13.5px] font-bold">{l.name}</span><span className="block text-[12px] text-[#5B616B]">{l.label}</span></span>
              </span>
              <a href={demoUrlEn(l.key)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="rounded border border-[#CBD1DB] bg-white px-2 py-1 text-center text-[12px] font-semibold text-[#1D3461] hover:border-[#1D3461]">See live ↗</a>
            </label>
          ))}
          <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-[13px] transition ${design === '' ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
            <input type="radio" name="design_pick" value="" checked={design === ''} onChange={() => setDesign('')} className="accent-[#1D3461]" />
            <span className="font-semibold">Let&apos;s decide together</span>
          </label>
        </div>
      </fieldset>

      <Field id="message" label="Anything else?" hint="Target launch date, languages, features you need, questions.">
        <textarea id="message" name="message" rows={4} maxLength={1500} className={`${input} resize-y`} />
      </Field>

      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-center gap-2.5 px-1 text-[14.5px] font-bold">
          <input type="checkbox" checked={agree && agreeTerms} onChange={(e) => { setAgree(e.target.checked); setAgreeTerms(e.target.checked) }} className="h-4 w-4 accent-[#D6402B]" />
          I agree to the following
        </label>
        <div className="rounded-md border border-[#E4E6EA]">
          <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[14px] font-semibold">
            <input type="checkbox" name="agree" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-4 w-4 accent-[#D6402B]" />
            <span className="flex-1">Privacy collection notice <span className="text-[#D6402B]">(required)</span></span>
            <a href="/imnewsroom/en/privacy" target="_blank" rel="noopener" className="text-[12.5px] font-normal text-[#5B616B] underline underline-offset-2">Privacy Policy</a>
          </label>
          <div tabIndex={0} aria-label="Privacy collection notice" className="max-h-40 overflow-y-auto border-t border-[#EEF0F3] bg-[#F8F9FA] px-4 py-3"><PolicyDoc sections={applyConsentSectionsEn()} compact /></div>
        </div>
        <div className="rounded-md border border-[#E4E6EA]">
          <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[14px] font-semibold">
            <input type="checkbox" name="agree_terms" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="h-4 w-4 accent-[#D6402B]" />
            <span className="flex-1">Terms of Service <span className="text-[#D6402B]">(required)</span></span>
            <a href="/imnewsroom/en/terms" target="_blank" rel="noopener" className="text-[12.5px] font-normal text-[#5B616B] underline underline-offset-2">Read in full</a>
          </label>
        </div>
      </div>

      {state.error && <p role="alert" className="text-[14px] font-semibold text-[#D6402B]">{state.error}</p>}
      <Submit />
    </form>
  )
}
