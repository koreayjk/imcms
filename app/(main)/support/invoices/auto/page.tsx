import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { billingItems, billingTargets, dueDate, kstToday, type BillingTarget } from '@/lib/billing'
import { ANNUAL_MONTHS, BETA_RATE, EXTRA_OUTLET_FEES, PRESS_MAIL_ADDON_FEE, PREMIUM_INCLUDED_EXTRA, SETUP_FEE, extraPlanLabel, extraPlanOf, planById, planName } from '@/lib/pricing'
import { monthLabelL, wonL } from '@/lib/support-i18n'
import PendingButton from '@/components/cms/PendingButton'
import { runBillingNow, saveOutletPlan } from './actions'

type Props = { searchParams: Promise<{ ok?: string; error?: string }> }
type PlanRow = { outlet_id: string; auto: boolean; cycle: 'monthly' | 'annual'; beta: boolean; start_month: string | null; bill_to: string | null; setup_fee_pending: boolean; custom_monthly: number | null }

const nextMonthOf = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// 운영팀: 매체별 자동 청구 설정 + 다음 청구 예정 금액
export default async function AutoBillingPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, isStaff, isSuper } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isStaff) redirect('/support')
  const won = (n: number) => wonL(n, lang)
  const monthLabel = (d: string) => monthLabelL(d, lang)

  const thisMonth = kstToday().slice(0, 7)
  const nextMonth = nextMonthOf(thisMonth)
  const [{ data: outlets }, plansRes, { data: cards }] = await Promise.all([
    supabase.from('outlets').select('*').order('created_at'),
    supabase.from('outlet_plans').select('*'),
    supabase.from('outlet_autopay').select('outlet_id, card_company, card_number, last_error').eq('active', true),
  ])
  const cardOf = new Map(((cards ?? []) as { outlet_id: string; card_company: string | null; card_number: string | null; last_error: string | null }[]).map((c) => [c.outlet_id, c]))
  const missingSql = !!plansRes.error
  const plans = new Map(((plansRes.data ?? []) as PlanRow[]).map((p) => [p.outlet_id, p]))

  // 다음 달 1일 청구 예정 (자동 청구를 켠 매체만, AI 추가 사용은 이번 달 지금까지 기준)
  let preview = new Map<string, ReturnType<typeof billingItems>>()
  let thisMonthHas = new Set<string>()
  if (!missingSql && process.env.PAYMENT_DB_SECRET) {
    try {
      const [next, now] = await Promise.all([billingTargets(supabase, nextMonth), billingTargets(supabase, thisMonth)])
      preview = new Map(next.map((tg: BillingTarget) => [tg.outlet_id, billingItems(tg, nextMonth)]))
      thisMonthHas = new Set(now.filter((tg) => tg.has_invoice).map((tg) => tg.outlet_id))
    } catch {
      // 미리보기 실패는 화면을 막지 않는다
    }
  }
  const nameOf = new Map((outlets ?? []).map((o) => [o.id, o.name as string]))

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="border-b-2 border-ink pb-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/support/invoices" className="text-[13px] text-muted hover:text-ink">{t('‹ 청구서', '‹ Invoices')}</Link>
          {isSuper && <Link href="/support/invoices/terminations" className="text-[13px] font-semibold text-danger hover:underline">{t('해지 관리 ›', 'Cancellations ›')}</Link>}
        </div>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-tight">{t('자동 청구', 'Auto-billing')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {lang === 'en' ? (
            <>
              For auto-billed publications, next month&apos;s invoice is created on the <strong className="text-ink">last day of each month (12:30 a.m.)</strong> and a &ldquo;payment scheduled for tomorrow&rdquo; email goes out.
              Publications with a registered card are charged automatically at <strong className="text-ink">10 a.m. on the 1st of each month</strong>; those without a card pay themselves with the payment link by the 5th.
              After the due date, an overdue notice goes out the next day, and after a 5-day grace period access is restricted (it is lifted as soon as payment is made). There are no late fees, and because the service is supplied by a U.S. company, no Korean VAT is added.
              A card is registered automatically when the customer agrees while paying their first invoice.
            </>
          ) : (
            <>
              자동 청구 매체는 <strong className="text-ink">매월 말일(0시 30분)</strong>에 다음 달 청구서가 만들어지고 &ldquo;내일 자동 결제 예정&rdquo; 안내 메일이 나갑니다.
              카드가 등록된 매체는 <strong className="text-ink">매월 1일 오전 10시</strong>에 자동 결제되고, 카드가 없는 매체는 5일까지 결제 링크로 직접 냅니다.
              기한이 지나면 다음 날 미납 안내가 가고, 유예 5일이 지나면 이용이 제한됩니다(결제하면 바로 풀림). 연체료는 없고, 해외 법인(미국) 공급이라 한국 부가세는 붙지 않습니다.
              카드는 고객이 첫 청구서를 결제할 때 동의하면 자동으로 등록됩니다.
            </>
          )}
        </p>
      </div>

      {searchParams.ok && <p role="status" className="mt-4 rounded-lg bg-published/10 px-4 py-3 text-[13.5px] text-published">{searchParams.ok}</p>}
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">{searchParams.error}</p>}
      {missingSql && <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">{t('Supabase에서 ', 'Run ')}<code>supabase/billing-auto.sql</code>{t('을 먼저 실행해 주세요.', ' in Supabase first.')}</p>}

      <div className="mt-5 rounded-xl bg-[#F8F9FA] px-5 py-4 text-[13px] leading-relaxed text-[#3A3F4A]">
        <p className="font-semibold text-ink">{t('청구서에 들어가는 항목', 'What goes on the invoice')}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {lang === 'en' ? (
            <>
              <li>Monthly plan fee (set the plan on the <Link href="/admin/ai-usage" className="text-[#2F6BF0] underline">AI usage</Link> screen) · {Math.round(BETA_RATE * 100)}% if beta half price applies</li>
              <li>Annual billing is charged once every 12 months from the first billing month, at {ANNUAL_MONTHS} months&apos; price</li>
              <li>Additional publications (Premium only): a publication whose &lsquo;Billed to&rsquo; is set is added to that publication&apos;s invoice at {won(EXTRA_OUTLET_FEES.basic)} (Basic), {won(EXTRA_OUTLET_FEES.standard)} (Standard) or {won(EXTRA_OUTLET_FEES.premium)} (Premium) per month, depending on its plan. Premium includes {PREMIUM_INCLUDED_EXTRA} Basic-spec publication; if you choose a higher spec, only the difference from the Basic price is charged. Saving sets that publication&apos;s plan to the chosen spec (AI limits, newsletters, etc. follow that plan)</li>
              <li>Add-on &lsquo;Auto-receive press releases by email&rsquo; (Basic and Standard): if the add-on is turned on for that publication under Newsroom → Press releases → Receive by email, {won(PRESS_MAIL_ADDON_FEE)} per month is added as a separate line (prorated by remaining days in the month it is turned on; monthly even for annual-billing publications). Premium includes it, so nothing is added.</li>
              <li>Last month&apos;s extra AI usage (uses over the limit, per 100 uses) · the setup fee of {won(SETUP_FEE)} goes on the next invoice once, if checked</li>
            </>
          ) : (
            <>
              <li>요금제 월 이용료 (요금제는 <Link href="/admin/ai-usage" className="text-[#2F6BF0] underline">AI 사용량</Link> 화면에서 정합니다) · 베타 반값이면 {Math.round(BETA_RATE * 100)}%</li>
              <li>1년 결제는 첫 청구 월부터 12개월마다 한 번, {ANNUAL_MONTHS}개월 값</li>
              <li>추가 매체(프리미엄 전용): &lsquo;청구 받을 매체&rsquo;를 고른 매체는 그 매체 청구서에 요금제(사양)에 따라 월 {won(EXTRA_OUTLET_FEES.basic)}(베이직) · {won(EXTRA_OUTLET_FEES.standard)}(스탠다드) · {won(EXTRA_OUTLET_FEES.premium)}(프리미엄)으로 붙습니다. 프리미엄은 베이직 사양 {PREMIUM_INCLUDED_EXTRA}개가 포함이고, 더 높은 사양을 고르면 베이직 금액과의 차액만 청구합니다. 저장하면 그 매체 요금제가 고른 사양으로 맞춰집니다 (AI 한도·뉴스레터 등이 그 요금제를 따름)</li>
              <li>부가 서비스 &lsquo;보도자료 메일 자동 수신&rsquo;(베이직·스탠다드): 편집국 → 보도자료 → 메일로 받기에서 그 매체의 부가 서비스를 켜 두면 매달 월 {won(PRESS_MAIL_ADDON_FEE)}이 별도 항목으로 붙습니다(켠 달은 남은 일수 일할 계산, 1년 결제 매체도 매월). 프리미엄은 포함이라 붙지 않습니다.</li>
              <li>지난달 AI 추가 사용 (한도를 넘겨 쓴 횟수, 100회마다) · 세팅비 {won(SETUP_FEE)}는 체크한 경우 다음 청구서에 한 번</li>
            </>
          )}
        </ul>
        {isSuper && !missingSql && (
          <form action={runBillingNow} className="mt-3">
            <PendingButton pending={t('만드는 중…', 'Creating…')} confirm={t(`${monthLabel(`${thisMonth}-01`)} 청구서를 지금 만들까요? 이미 있는 매체는 건너뜁니다.`, `Create the invoices for ${monthLabel(`${thisMonth}-01`)} now? Publications that already have one are skipped.`)} className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">
              {t(`${monthLabel(`${thisMonth}-01`)} 청구서 지금 만들기`, `Create ${monthLabel(`${thisMonth}-01`)} invoices now`)}
            </PendingButton>
            <span className="ml-2 text-[12px] text-muted">{t('매일 0시 30분에 자동으로도 확인합니다', 'Also checked automatically every day at 12:30 a.m.')}</span>
          </form>
        )}
      </div>

      {(() => {
        const all = outlets ?? []
        const on = all.filter((o) => plans.get(o.id)?.auto)
        const off = all.filter((o) => !plans.get(o.id)?.auto)
        const lastDay = new Date(Date.parse(`${nextMonth}-01T00:00:00Z`) - 864e5).toISOString().slice(0, 10)
        const total = on.reduce((n, o) => n + (preview.get(o.id)?.totals.total ?? 0), 0)

        // 매체 한 곳의 설정 (자주 바꾸지 않아 접어 둔다)
        const settings = (o: (typeof all)[number]) => {
          const p = plans.get(o.id)
          return (
            <form action={saveOutletPlan} className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="outlet_id" value={o.id} />
              <label className="flex items-center gap-2 font-semibold lg:col-span-4">
                <input type="checkbox" name="auto" defaultChecked={!!p?.auto} className="h-4 w-4" />
                {t('매월 자동 청구', 'Bill automatically every month')}
              </label>
              <label className="block">
                <span className="field-label">{t('결제 주기', 'Billing cycle')}</span>
                <select name="cycle" defaultValue={p?.cycle ?? 'monthly'} className="field-input py-1.5">
                  <option value="monthly">{t('월 결제', 'Monthly billing')}</option>
                  <option value="annual">{t(`1년 결제 (${ANNUAL_MONTHS}개월 값)`, `Annual billing (${ANNUAL_MONTHS} months' price)`)}</option>
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('첫 청구 월', 'First billing month')}</span>
                <input type="month" name="start_month" defaultValue={p?.start_month?.slice(0, 7) ?? nextMonth} className="field-input py-1.5" />
              </label>
              <label className="block">
                <span className="field-label">{t('청구 받을 매체', 'Billed to')}</span>
                <select name="bill_to" defaultValue={p?.bill_to ?? ''} className="field-input py-1.5">
                  <option value="">{t('이 매체 (따로 청구)', 'This publication (billed separately)')}</option>
                  {all.filter((x) => x.id !== o.id).map((x) => <option key={x.id} value={x.id}>{t(`${x.name} 청구서에 추가 매체로`, `As an additional publication on ${x.name}'s invoice`)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('추가 매체 요금제 (청구 받을 매체를 고른 경우)', 'Additional publication plan (when "Billed to" is set)')}</span>
                <select name="extra_plan" defaultValue={p?.bill_to ? extraPlanOf(o.plan) : 'basic'} className="field-input py-1.5">
                  {(['basic', 'standard', 'premium'] as const).map((k) => <option key={k} value={k}>{t(`${extraPlanLabel(k)} 사양 · 월 ${wonL(EXTRA_OUTLET_FEES[k], 'ko')}`, `${extraPlanLabel(k, 'en')} spec · ${won(EXTRA_OUTLET_FEES[k])}/month`)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">{t('맞춤 월 금액 (선택)', 'Custom monthly amount (optional)')}</span>
                <input name="custom_monthly" inputMode="numeric" defaultValue={p?.custom_monthly ?? ''} placeholder={t('요금제 금액 대신', 'Instead of the plan price')} className="field-input py-1.5 text-right tabular-nums" />
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="beta" defaultChecked={!!p?.beta} className="h-4 w-4" />
                {t('베타 반값 (첫 청구 월부터 3개월)', 'Beta half price (3 months from the first billing month)')}
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input type="checkbox" name="setup_fee_pending" defaultChecked={!!p?.setup_fee_pending} className="h-4 w-4" />
                {t(`다음 청구서에 세팅비 ${wonL(SETUP_FEE, 'ko')} 넣기`, `Add the ${won(SETUP_FEE)} setup fee to the next invoice`)}
              </label>
              <div className="flex justify-end">
                <PendingButton pending={t('저장 중…', 'Saving…')} className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[13px] font-bold text-white">{t('저장', 'Save')}</PendingButton>
              </div>
            </form>
          )
        }

        return (
          <>
            <section className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[16px] font-bold">{t('자동 청구 중인 매체', 'Publications on auto-billing')} <span className="text-[13px] font-normal text-muted">{t(`${on.length}곳`, `${on.length}`)}</span></h2>
                {on.length > 0 && preview.size > 0 && <p className="text-[13px] tabular-nums text-muted">{t(`${monthLabel(`${nextMonth}-01`)} 청구 예정 합계`, `Expected total for ${monthLabel(`${nextMonth}-01`)}`)} <strong className="text-ink">{won(total)}</strong></p>}
              </div>
              {on.length === 0 ? (
                <p className="mt-3 rounded-xl bg-white px-5 py-6 text-[13.5px] text-muted ring-1 ring-black/5">{t('자동 청구 중인 매체가 없습니다. 청구서를 처음 발행할 때 “매달 자동 청구로 설정”을 체크하면 여기에 나타납니다.', 'No publications are on auto-billing. They appear here when you check “Set to automatic monthly billing” while issuing a first invoice.')}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {on.map((o) => {
                    const p = plans.get(o.id)!
                    const plan = planById(o.plan)
                    const pv = preview.get(o.id)
                    const card = cardOf.get(o.id)
                    const parent = p.bill_to ? nameOf.get(p.bill_to) : null
                    return (
                      <li key={o.id} className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                        <details>
                          <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1.5">
                            <span className="min-w-[8rem] text-[15px] font-bold">{o.name}</span>
                            <span className="rounded bg-[#F4F5F7] px-2 py-0.5 text-[12px] font-semibold text-[#5B616B]">{p.custom_monthly != null ? t(`맞춤 월 ${wonL(p.custom_monthly, 'ko')}`, `Custom ${won(p.custom_monthly)}/month`) : plan ? `${planName(plan.id, lang)}${plan.monthly ? t(` 월 ${wonL(plan.monthly, 'ko')}`, ` ${won(plan.monthly)}/month`) : ''}` : t('요금제 없음', 'No plan')}</span>
                            {p.beta && <span className="rounded bg-[#FFF3EB] px-2 py-0.5 text-[12px] font-bold text-[#C2410C]">{t('베타 반값', 'Beta half price')}</span>}
                            {p.cycle === 'annual' && <span className="rounded bg-[#EEF3FF] px-2 py-0.5 text-[12px] font-semibold text-[#2F6BF0]">{t('1년 결제', 'Annual billing')}</span>}
                            {parent && <span className="text-[12px] text-muted">{t(`→ ${parent} 청구서에 포함`, `→ included on ${parent}'s invoice`)}</span>}
                            <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${card ? (card.last_error ? 'bg-danger/10 text-danger' : 'bg-published/10 text-published') : 'bg-draft/15 text-[#6B5F22]'}`}>
                              {card ? `${t('카드', 'Card')} ${card.card_company ?? ''} ${card.card_number ?? ''}${card.last_error ? t(' · 결제 실패', ' · payment failed') : ''}` : t('카드 미등록 (직접 결제)', 'No card registered (pays manually)')}
                            </span>
                            {(o as { billing_hold?: boolean }).billing_hold && <span className="rounded bg-danger/10 px-2 py-0.5 text-[12px] font-semibold text-danger">{t('미납 · 이용 제한 중', 'Unpaid · access restricted')}</span>}
                            {thisMonthHas.has(o.id) && <span className="rounded bg-[#EEF3FF] px-2 py-0.5 text-[12px] font-semibold text-[#2F6BF0]">{t(`${monthLabel(`${thisMonth}-01`)} 청구서 있음`, `${monthLabel(`${thisMonth}-01`)} invoice issued`)}</span>}
                            <span className="ml-auto text-[14px] font-bold tabular-nums">{pv ? (pv.items.length ? won(pv.totals.total) : t('청구 없음', 'Nothing to bill')) : '-'}</span>
                          </summary>
                          {pv && pv.items.length > 0 && (
                            <div className="mt-3 rounded-lg border border-line px-4 py-3 text-[13px]">
                              <p className="font-semibold">{lang === 'en' ? `${monthLabel(`${nextMonth}-01`)} invoice · issued ${lastDay.replace(/-/g, '.')} · ${card ? `charged ${nextMonth.replace('-', '.')}.01 at 10 a.m. (card)` : `due ${dueDate(nextMonth, `${nextMonth}-01`).replace(/-/g, '.')}`}` : `${monthLabel(`${nextMonth}-01`)} 청구 · 발행 ${lastDay.replace(/-/g, '.')} · ${card ? `결제 ${nextMonth.replace('-', '.')}.01 오전 10시 (카드)` : `납부 기한 ${dueDate(nextMonth, `${nextMonth}-01`).replace(/-/g, '.')}`}`}</p>
                              <ul className="mt-1.5 space-y-0.5 text-muted">
                                {pv.items.map((it, i) => (
                                  <li key={i} className="flex justify-between gap-3"><span>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ''}</span><span className="shrink-0 whitespace-nowrap tabular-nums">{won(it.qty * it.unit_price)}</span></li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <details className="mt-3">
                            <summary className="cursor-pointer text-[12.5px] font-semibold text-[#2F6BF0]">{t('설정 바꾸기', 'Change settings')}</summary>
                            {settings(o)}
                          </details>
                        </details>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {off.length > 0 && (
              <details className="mt-6 rounded-xl bg-white p-4 ring-1 ring-black/5">
                <summary className="cursor-pointer text-[14px] font-bold">{t('자동 청구가 꺼진 매체', 'Publications with auto-billing off')} <span className="font-normal text-muted">{t(`${off.length}곳 · 켜려면 펼치세요`, `${off.length} · expand to turn on`)}</span></summary>
                <ul className="mt-3 divide-y divide-line">
                  {off.map((o) => {
                    const plan = planById(o.plan)
                    return (
                      <li key={o.id} className="py-3">
                        <details>
                          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[14px]">
                            <span className="font-semibold">{o.name}</span>
                            <span className="rounded bg-[#F4F5F7] px-2 py-0.5 text-[12px] font-semibold text-[#5B616B]">{plan ? planName(plan.id, lang) : t('요금제 없음', 'No plan')}</span>
                          </summary>
                          {settings(o)}
                        </details>
                      </li>
                    )
                  })}
                </ul>
              </details>
            )}
          </>
        )
      })()}
    </div>
  )
}
