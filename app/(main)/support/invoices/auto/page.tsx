import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { billingItems, billingTargets, dueDate, kstToday, type BillingTarget } from '@/lib/billing'
import { ANNUAL_MONTHS, BETA_RATE, EXTRA_OUTLET_FEE, PREMIUM_INCLUDED_EXTRA, SETUP_FEE, planById } from '@/lib/pricing'
import { monthLabel, won } from '@/lib/support'
import PendingButton from '@/components/cms/PendingButton'
import { runBillingNow, saveOutletPlan } from './actions'

type Props = { searchParams: { ok?: string; error?: string } }
type PlanRow = { outlet_id: string; auto: boolean; cycle: 'monthly' | 'annual'; beta: boolean; start_month: string | null; bill_to: string | null; setup_fee_pending: boolean; custom_monthly: number | null }

const nextMonthOf = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

// 운영팀: 매체별 자동 청구 설정 + 다음 청구 예정 금액
export default async function AutoBillingPage({ searchParams }: Props) {
  const { supabase, isStaff, isSuper } = await getCmsContext()
  if (!isStaff) redirect('/support')

  const thisMonth = kstToday().slice(0, 7)
  const nextMonth = nextMonthOf(thisMonth)
  const [{ data: outlets }, plansRes] = await Promise.all([
    supabase.from('outlets').select('id, name, plan').order('created_at'),
    supabase.from('outlet_plans').select('*'),
  ])
  const missingSql = !!plansRes.error
  const plans = new Map(((plansRes.data ?? []) as PlanRow[]).map((p) => [p.outlet_id, p]))

  // 다음 달 1일 청구 예정 (자동 청구를 켠 매체만, AI 추가 사용은 이번 달 지금까지 기준)
  let preview = new Map<string, ReturnType<typeof billingItems>>()
  let thisMonthHas = new Set<string>()
  if (!missingSql && process.env.PAYMENT_DB_SECRET) {
    try {
      const [next, now] = await Promise.all([billingTargets(supabase, nextMonth), billingTargets(supabase, thisMonth)])
      preview = new Map(next.map((t: BillingTarget) => [t.outlet_id, billingItems(t, nextMonth)]))
      thisMonthHas = new Set(now.filter((t) => t.has_invoice).map((t) => t.outlet_id))
    } catch {
      // 미리보기 실패는 화면을 막지 않는다
    }
  }
  const nameOf = new Map((outlets ?? []).map((o) => [o.id, o.name as string]))

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="border-b-2 border-ink pb-4">
        <Link href="/support/invoices" className="text-[13px] text-muted hover:text-ink">‹ 청구서</Link>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-tight">자동 청구</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          자동 청구를 켠 매체는 <strong className="text-ink">매월 1일</strong>에 청구서가 만들어지고 안내 메일이 나갑니다. 납부 기한은 <strong className="text-ink">10일</strong>이며,
          자동결제를 등록한 매체는 10일 오전 10시에 결제됩니다. 모든 금액은 부가세 포함입니다.
        </p>
      </div>

      {searchParams.ok && <p role="status" className="mt-4 rounded-lg bg-published/10 px-4 py-3 text-[13.5px] text-published">{searchParams.ok}</p>}
      {searchParams.error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">{searchParams.error}</p>}
      {missingSql && <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">Supabase에서 <code>supabase/billing-auto.sql</code>을 먼저 실행해 주세요.</p>}

      <div className="mt-5 rounded-xl bg-[#F8F9FA] px-5 py-4 text-[13px] leading-relaxed text-[#3A3F4A]">
        <p className="font-semibold text-ink">청구서에 들어가는 항목</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>요금제 월 이용료 (요금제는 <Link href="/admin/ai-usage" className="text-[#2F6BF0] underline">AI 사용량</Link> 화면에서 정합니다) · 베타 반값이면 {Math.round(BETA_RATE * 100)}%</li>
          <li>1년 결제는 첫 청구 월부터 12개월마다 한 번, {ANNUAL_MONTHS}개월 값</li>
          <li>추가 매체(프리미엄 전용): &lsquo;청구 받을 매체&rsquo;를 고른 매체는 그 매체 청구서에 월 {won(EXTRA_OUTLET_FEE)}으로 붙습니다 (프리미엄은 {PREMIUM_INCLUDED_EXTRA}개 포함). 추가 매체로 저장하면 그 매체 요금제는 베이직으로 맞춰집니다 (AI 월 300회 등)</li>
          <li>지난달 AI 추가 사용 (한도를 넘겨 쓴 횟수, 100회마다) · 세팅비 {won(SETUP_FEE)}는 체크한 경우 다음 청구서에 한 번</li>
        </ul>
        {isSuper && !missingSql && (
          <form action={runBillingNow} className="mt-3">
            <PendingButton pending="만드는 중…" confirm={`${monthLabel(`${thisMonth}-01`)} 청구서를 지금 만들까요? 이미 있는 매체는 건너뜁니다.`} className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white">
              {monthLabel(`${thisMonth}-01`)} 청구서 지금 만들기
            </PendingButton>
            <span className="ml-2 text-[12px] text-muted">매일 0시 30분에 자동으로도 확인합니다</span>
          </form>
        )}
      </div>

      <ul className="mt-6 space-y-4">
        {(outlets ?? []).map((o) => {
          const p = plans.get(o.id)
          const plan = planById(o.plan)
          const pv = preview.get(o.id)
          const parent = p?.bill_to ? nameOf.get(p.bill_to) : null
          return (
            <li key={o.id} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-bold">{o.name}</h2>
                <span className="rounded bg-[#F4F5F7] px-2 py-0.5 text-[12px] font-semibold text-[#5B616B]">{plan ? `${plan.name}${plan.monthly ? ` 월 ${won(plan.monthly)}` : ''}` : '요금제 없음'}</span>
                <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${p?.auto ? 'bg-published/10 text-published' : 'bg-line/60 text-muted'}`}>{p?.auto ? '자동 청구 켜짐' : '자동 청구 꺼짐'}</span>
                {thisMonthHas.has(o.id) && <span className="rounded bg-[#EEF3FF] px-2 py-0.5 text-[12px] font-semibold text-[#2F6BF0]">{monthLabel(`${thisMonth}-01`)} 청구서 있음</span>}
              </div>

              {p?.auto && parent && <p className="mt-2 text-[13px] text-muted">{parent} 청구서에 추가 매체로 함께 청구됩니다.</p>}
              {p?.bill_to && (() => {
                // 매체 추가는 프리미엄 전용 (맞춤 금액 고객은 예외)
                const root = (outlets ?? []).find((x) => x.id === p.bill_to)
                const rootPlan = plans.get(p.bill_to)
                return root && root.plan !== 'premium' && rootPlan?.custom_monthly == null
                  ? <p role="alert" className="mt-2 rounded bg-danger/10 px-3 py-2 text-[12.5px] text-danger">⚠ {root.name}은(는) 프리미엄 요금제가 아닙니다. 매체 추가는 프리미엄 전용이니 요금제를 바꾸거나 맞춤 금액으로 정해 주세요.</p>
                  : null
              })()}
              {pv && (
                <div className="mt-3 rounded-lg border border-line px-4 py-3 text-[13px]">
                  <p className="flex flex-wrap justify-between gap-2 font-semibold">
                    <span>{monthLabel(`${nextMonth}-01`)} 1일 청구 예정 · 납부 기한 {dueDate(nextMonth, `${nextMonth}-01`).replace(/-/g, '.')}</span>
                    <span className="tabular-nums">{pv.items.length ? won(pv.totals.total) : '청구 없음'}</span>
                  </p>
                  {pv.items.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-muted">
                      {pv.items.map((it, i) => (
                        <li key={i} className="flex justify-between gap-3"><span>{it.name}{it.qty > 1 ? ` × ${it.qty}` : ''}</span><span className="tabular-nums">{won(it.qty * it.unit_price)}</span></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <form action={saveOutletPlan} className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="outlet_id" value={o.id} />
                <label className="flex items-center gap-2 font-semibold lg:col-span-4">
                  <input type="checkbox" name="auto" defaultChecked={!!p?.auto} className="h-4 w-4" />
                  매월 자동 청구
                </label>
                <label className="block">
                  <span className="field-label">결제 주기</span>
                  <select name="cycle" defaultValue={p?.cycle ?? 'monthly'} className="field-input py-1.5">
                    <option value="monthly">월 결제</option>
                    <option value="annual">1년 결제 ({ANNUAL_MONTHS}개월 값)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">첫 청구 월</span>
                  <input type="month" name="start_month" defaultValue={p?.start_month?.slice(0, 7) ?? nextMonth} className="field-input py-1.5" />
                </label>
                <label className="block">
                  <span className="field-label">청구 받을 매체</span>
                  <select name="bill_to" defaultValue={p?.bill_to ?? ''} className="field-input py-1.5">
                    <option value="">이 매체 (따로 청구)</option>
                    {(outlets ?? []).filter((x) => x.id !== o.id).map((x) => <option key={x.id} value={x.id}>{x.name} 청구서에 추가 매체로</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">맞춤 월 금액 (선택)</span>
                  <input name="custom_monthly" inputMode="numeric" defaultValue={p?.custom_monthly ?? ''} placeholder="요금제 금액 대신" className="field-input py-1.5 text-right tabular-nums" />
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="beta" defaultChecked={!!p?.beta} className="h-4 w-4" />
                  베타 반값
                </label>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input type="checkbox" name="setup_fee_pending" defaultChecked={!!p?.setup_fee_pending} className="h-4 w-4" />
                  다음 청구서에 세팅비 {won(SETUP_FEE)} 넣기
                </label>
                <div className="flex justify-end">
                  <PendingButton pending="저장 중…" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[13px] font-bold text-white">저장</PendingButton>
                </div>
              </form>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
