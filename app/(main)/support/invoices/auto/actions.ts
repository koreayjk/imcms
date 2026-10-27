'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { kstToday, runBilling } from '@/lib/billing'
import { cmsOrigin } from '@/lib/origin'
import { extraPlanLabel } from '@/lib/pricing'

const back = (msg: string, kind: 'ok' | 'error' = 'ok') => redirect(`/support/invoices/auto?${kind}=${encodeURIComponent(msg)}`)

// 매체 한 곳의 자동 청구 설정 저장 (운영팀)
export async function saveOutletPlan(form: FormData) {
  const { supabase, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isStaff) redirect('/support')
  const outlet_id = String(form.get('outlet_id') ?? '')
  const auto = form.get('auto') === 'on'
  const cycle = form.get('cycle') === 'annual' ? 'annual' : 'monthly'
  const startRaw = String(form.get('start_month') ?? '')
  const start_month = /^\d{4}-\d{2}$/.test(startRaw) ? `${startRaw}-01` : null
  const billToRaw = String(form.get('bill_to') ?? '')
  const bill_to = /^[0-9a-f-]{36}$/.test(billToRaw) && billToRaw !== outlet_id ? billToRaw : null
  const customRaw = String(form.get('custom_monthly') ?? '').replace(/[^\d]/g, '')
  const custom_monthly = customRaw ? Number(customRaw) : null
  if (!/^[0-9a-f-]{36}$/.test(outlet_id)) back(t('매체를 찾지 못했습니다.', 'Publication not found.'), 'error')
  if (auto && !start_month) back(t('자동 청구를 켜려면 첫 청구 월을 정해 주세요.', 'Choose a first billing month to turn on auto-billing.'), 'error')

  const { error } = await supabase.from('outlet_plans').upsert({
    outlet_id, auto, cycle, start_month, bill_to, custom_monthly,
    beta: form.get('beta') === 'on',
    setup_fee_pending: form.get('setup_fee_pending') === 'on',
    updated_at: new Date().toISOString(),
  })
  if (error) back(/outlet_plans/.test(error.message) ? t('Supabase에서 billing-auto.sql을 먼저 실행해 주세요.', 'Run billing-auto.sql in Supabase first.') : `${t('저장하지 못했습니다', 'Could not save')}: ${error.message}`, 'error')
  // 추가 매체는 고른 요금제(사양)로 맞춘다: 베이직(기본) · 스탠다드 · 프리미엄 — AI 한도·뉴스레터 등이 그 요금제를 따른다
  let note = ''
  if (bill_to) {
    const want = (['basic', 'standard', 'premium'] as const).find((x) => x === String(form.get('extra_plan') ?? '')) ?? 'basic'
    const { data: cur } = await supabase.from('outlets').select('plan').eq('id', outlet_id).maybeSingle()
    if (cur && cur.plan !== want) {
      const { error: e } = await supabase.from('outlets').update({ plan: want }).eq('id', outlet_id)
      const label = extraPlanLabel(want, lang)
      note = e ? t(` (요금제를 ${label}로 바꾸지 못했습니다: ${e.message})`, ` (Could not change the plan to ${label}: ${e.message})`) : t(` 추가 매체 요금제를 ${label}로 맞췄습니다.`, ` The additional publication's plan was set to ${label}.`)
    }
  }
  revalidatePath('/support/invoices/auto')
  back(`${t('저장했습니다.', 'Saved.')}${note}`)
}

// 이번 달 청구서 지금 만들기 (총관리자). 이미 있는 매체는 건너뛴다
export async function runBillingNow() {
  const { supabase, isSuper } = await getCmsContext()
  const { t } = await getT()
  if (!isSuper) redirect('/support')
  if (!process.env.PAYMENT_DB_SECRET) back(t('PAYMENT_DB_SECRET 설정이 없습니다.', 'PAYMENT_DB_SECRET is not set.'), 'error')
  let msg = ''
  try {
    // 매체가 많으면 한 번에 다 못 만든다: 50초 안에 만든 만큼만 만들고, 남은 곳은 버튼을 다시 누르면 이어서 만든다
    const r = await runBilling(supabase, kstToday().slice(0, 7), (await cmsOrigin()), Date.now() + 50_000)
    msg = r.created.length ? t(`청구서 ${r.created.length}건을 만들었습니다.`, `Created ${r.created.length} ${r.created.length === 1 ? 'invoice' : 'invoices'}.`) : t('새로 만들 청구서가 없습니다.', 'There are no new invoices to create.')
    if (r.pending) msg += t(` 아직 ${r.pending}곳이 남았습니다. 버튼을 한 번 더 눌러 주세요.`, ` ${r.pending} ${r.pending === 1 ? 'publication is' : 'publications are'} still pending. Press the button once more.`)
    // '이미 있음'은 빼고, 문제가 있는 곳만 (많으면 앞의 5곳만)
    const issues = r.skipped.filter((s) => !s.reason.includes('이미 있음'))
    if (issues.length) msg += ` (${t('건너뜀', 'Skipped')}: ${issues.slice(0, 5).map((s) => `${s.outlet} – ${s.reason === '청구할 항목 없음' ? t('청구할 항목 없음', 'No items to bill') : s.reason}`).join(', ')}${issues.length > 5 ? t(` 외 ${issues.length - 5}곳`, ` and ${issues.length - 5} more`) : ''})`
  } catch (e) {
    back(`${t('만들지 못했습니다', 'Could not create them')}: ${e instanceof Error ? e.message : String(e)}`, 'error')
  }
  revalidatePath('/support', 'layout')
  back(msg)
}
