'use client'

import { useState, useTransition } from 'react'
import { saveOutletAddon, saveOutletLimit, savePlanLimit, type OutletLimit, type PlanLimit } from '@/app/(main)/press/email/actions'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

const PLAN_LABELS: Record<'ko' | 'en', Record<string, string>> = {
  ko: { basic: '베이직', standard: '스탠다드', premium: '프리미엄', other: '엔터프라이즈·요금제 없음', '': '요금제 없음' },
  en: { basic: 'Basic', standard: 'Standard', premium: 'Premium', other: 'Enterprise / no plan', '': 'No plan' },
}

// 총관리자: 요금제별 기본 한도 + 언론사마다 따로 정하기 (한국 시간 0시에 새로 시작, 넘는 날은 받지 않음)
export default function PressMailLimits({ initial, plans: initialPlans }: { initial: OutletLimit[]; plans: PlanLimit[] }) {
  const t = useT()
  const lang = useCmsLang()
  const en = lang === 'en'
  const PLAN_LABEL = PLAN_LABELS[lang]
  const [rows, setRows] = useState(initial)
  const [plans, setPlans] = useState(initialPlans)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ id?: string; text: string; error?: boolean }>({ text: '' })
  const planKey = (p: string) => (p === 'basic' || p === 'standard' || p === 'premium' ? p : 'other')
  const planLimit = (p: string) => plans.find((x) => x.plan === planKey(p))?.daily_limit ?? 30

  const saveOutlet = (r: OutletLimit, raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw)
    start(async () => {
      const res = await saveOutletLimit(r.outlet_id, n)
      if (res.error) return setMsg({ id: r.outlet_id, text: res.error, error: true })
      setRows((all) => all.map((x) => (x.outlet_id === r.outlet_id ? { ...x, daily_limit: n ?? planLimit(x.plan), is_custom: n !== null } : x)))
      setMsg({ id: r.outlet_id, text: n === null ? (en ? `Reset to the plan default limit (${planLimit(r.plan)}/day).` : `요금제 기본 한도(${planLimit(r.plan)}건)로 되돌렸습니다.`) : (en ? `Saved a limit of ${n} per day.` : `하루 ${n}건으로 저장했습니다.`) })
    })
  }
  const toggleAddon = (r: OutletLimit) => {
    const on = !r.addon
    start(async () => {
      const res = await saveOutletAddon(r.outlet_id, on)
      if (res.error) return setMsg({ id: r.outlet_id, text: res.error, error: true })
      setRows((all) => all.map((x) => (x.outlet_id === r.outlet_id ? { ...x, addon: on } : x)))
      setMsg({ id: r.outlet_id, text: on ? t('부가 서비스를 켰습니다. 오늘부터 말일까지는 일할로 다음 청구서에, 그다음부터 월 39,000원이 들어갑니다.', 'The add-on is on. The fee from today to the end of the month is prorated on the next invoice, and KRW 39,000/month applies after that.') : t('부가 서비스를 껐습니다. 이후 오는 메일은 받지 않습니다.', 'The add-on is off. Emails that arrive from now on will not be received.') })
    })
  }
  const savePlan = (plan: PlanLimit['plan'], raw: string) => {
    const n = Number(raw)
    start(async () => {
      const res = await savePlanLimit(plan, n)
      if (res.error) return setMsg({ id: `plan-${plan}`, text: res.error, error: true })
      setPlans((all) => all.map((x) => (x.plan === plan ? { ...x, daily_limit: n } : x)))
      setRows((all) => all.map((x) => (planKey(x.plan) === plan ? { ...x, plan_limit: n, daily_limit: x.is_custom ? x.daily_limit : n } : x)))
      setMsg({ id: `plan-${plan}`, text: en ? `Saved the ${PLAN_LABEL[plan]} default limit as ${n} per day.` : `${PLAN_LABEL[plan]} 기본 한도를 하루 ${n}건으로 저장했습니다.` })
    })
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-4 sm:p-6">
      <h2 className="text-[15px] font-bold">{t('메일로 받는 보도자료 하루 한도', 'Daily limit for press releases received by email')} <span className="text-[12px] font-normal text-muted">{t('(총관리자에게만 보입니다)', '(visible to Super Admins only)')}</span></h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {en ? <>
          The number of press releases one outlet can receive by email. Once the day&apos;s limit is reached, emails that arrive that day are not received, and from midnight the next day (Korea time) new emails are received again up to the limit.
          Set a default limit for each plan, and change it separately only for outlets that need it.
          On Basic and Standard, only outlets that turn on the <b>add-on (KRW 39,000/month)</b> receive emails (3 trial emails before it is turned on). Premium and Enterprise include it by default.
        </> : <>
          언론사 한 곳이 메일로 받을 수 있는 보도자료 수입니다. 그날 한도를 넘으면 그날 오는 메일은 받지 않고, 다음 날 0시(한국 시간)부터 새로 오는 메일을 다시 한도까지 받습니다.
          요금제마다 기본 한도를 정하고, 필요한 언론사만 따로 바꿉니다.
          베이직·스탠다드는 <b>부가 서비스(월 39,000원)</b>를 켠 매체만 메일을 받습니다(켜기 전에는 체험 3통). 프리미엄·엔터프라이즈는 기본 포함입니다.
        </>}
      </p>

      <h3 className="mt-4 text-[13.5px] font-bold">{t('요금제별 기본 한도', 'Default limit by plan')}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {plans.map((pl) => (
          <li key={pl.plan} className="rounded-lg border border-line px-3 py-2.5">
            <form className="flex items-center gap-2 text-[13.5px]" onSubmit={(e) => { e.preventDefault(); savePlan(pl.plan, String(new FormData(e.currentTarget).get('limit') ?? '')) }}>
              <label htmlFor={`plan-${pl.plan}`} className="min-w-0 flex-1 font-semibold">{PLAN_LABEL[pl.plan]}</label>
              <input id={`plan-${pl.plan}`} name="limit" type="number" min={0} max={2000} defaultValue={pl.daily_limit} className="field-input w-20 py-1 text-right" />
              <span className="text-muted">{t('건/일', '/day')}</span>
              <button type="submit" disabled={pending} className="btn-secondary px-3 py-1 text-[12.5px]">{t('저장', 'Save')}</button>
            </form>
            {msg.id === `plan-${pl.plan}` && <p role={msg.error ? 'alert' : 'status'} className={`mt-1 text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.text}</p>}
          </li>
        ))}
      </ul>

      <h3 className="mt-5 text-[13.5px] font-bold">{t('언론사별 (요금제 기본 한도와 다르게 정하려는 곳만 적으세요)', 'By outlet (fill in only the outlets that should differ from the plan default)')}</h3>
      <ul className="mt-1 divide-y divide-line text-[13.5px]">
        {rows.map((r) => (
          <li key={r.outlet_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
            <span className="min-w-[10rem] flex-1"><span className="font-semibold">{r.outlet_name}</span> <span className="ml-1 text-[12px] text-muted">{PLAN_LABEL[planKey(r.plan) === 'other' && !r.plan ? '' : planKey(r.plan)]}</span></span>
            {r.included
              ? <span className="rounded bg-published/10 px-2 py-0.5 text-[12px] font-semibold text-published">{t('요금제 포함', 'Included in plan')}</span>
              : (
                <button type="button" disabled={pending} onClick={() => toggleAddon(r)} aria-pressed={!!r.addon} className={`rounded px-2.5 py-1 text-[12px] font-semibold ${r.addon ? 'bg-published text-white' : 'border border-line text-muted hover:border-ink hover:text-ink'}`}>
                  {r.addon ? t('부가 서비스 켜짐', 'Add-on on') : (en ? `Off · ${r.trial_used ?? 0} trial ${(r.trial_used ?? 0) === 1 ? 'email' : 'emails'} used` : `꺼짐 · 체험 ${r.trial_used ?? 0}통 씀`)}
                </button>
              )}
            <span className="tabular-nums text-muted">{en ? `Today ${r.used_today}/${r.daily_limit}` : `오늘 ${r.used_today}/${r.daily_limit}건`}{r.is_custom ? t(' (따로 정함)', ' (custom)') : ''}{r.dropped_today > 0 ? <b className="ml-1 text-danger">· {t('못 받음', 'Missed')} {r.dropped_today}</b> : null}{!r.addon && !r.included && (r.dropped_week ?? 0) > 0 ? <b className="ml-1 text-draft">· {en ? `No add-on: ${r.dropped_week} ${r.dropped_week === 1 ? 'email' : 'emails'} missed in 7 days (possible sign-up)` : `부가 서비스 없어 7일간 ${r.dropped_week}통 못 받음 (신청 후보)`}</b> : null}</span>
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); saveOutlet(r, String(new FormData(e.currentTarget).get('limit') ?? '')) }}>
              <label className="sr-only" htmlFor={`lim-${r.outlet_id}`}>{r.outlet_name} {t('하루 한도', 'daily limit')}</label>
              <input id={`lim-${r.outlet_id}`} name="limit" type="number" min={0} max={2000} defaultValue={r.is_custom ? r.daily_limit : ''} placeholder={String(planLimit(r.plan))} className="field-input w-24 py-1 text-right" />
              <span className="text-muted">{t('건', '')}</span>
              <button type="submit" disabled={pending} className="btn-secondary px-3 py-1 text-[12.5px]">{t('저장', 'Save')}</button>
            </form>
            {msg.id === r.outlet_id && <span role={msg.error ? 'alert' : 'status'} className={`w-full text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.text}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
