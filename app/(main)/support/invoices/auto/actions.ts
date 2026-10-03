'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { kstToday, runBilling } from '@/lib/billing'
import { siteOrigin } from '@/lib/origin'

const back = (msg: string, kind: 'ok' | 'error' = 'ok') => redirect(`/support/invoices/auto?${kind}=${encodeURIComponent(msg)}`)

// 매체 한 곳의 자동 청구 설정 저장 (운영팀)
export async function saveOutletPlan(form: FormData) {
  const { supabase, isStaff } = await getCmsContext()
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
  if (!/^[0-9a-f-]{36}$/.test(outlet_id)) back('매체를 찾지 못했습니다.', 'error')
  if (auto && !start_month) back('자동 청구를 켜려면 첫 청구 월을 정해 주세요.', 'error')

  const { error } = await supabase.from('outlet_plans').upsert({
    outlet_id, auto, cycle, start_month, bill_to, custom_monthly,
    beta: form.get('beta') === 'on',
    setup_fee_pending: form.get('setup_fee_pending') === 'on',
    updated_at: new Date().toISOString(),
  })
  if (error) back(/outlet_plans/.test(error.message) ? 'Supabase에서 billing-auto.sql을 먼저 실행해 주세요.' : `저장하지 못했습니다: ${error.message}`, 'error')
  revalidatePath('/support/invoices/auto')
  back('저장했습니다.')
}

// 이번 달 청구서 지금 만들기 (총관리자). 이미 있는 매체는 건너뛴다
export async function runBillingNow() {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) redirect('/support')
  if (!process.env.PAYMENT_DB_SECRET) back('PAYMENT_DB_SECRET 설정이 없습니다.', 'error')
  let msg = ''
  try {
    const r = await runBilling(supabase, kstToday().slice(0, 7), siteOrigin())
    msg = r.created.length ? `청구서 ${r.created.length}건을 만들었습니다.` : '새로 만들 청구서가 없습니다.'
    if (r.skipped.length) msg += ` (건너뜀: ${r.skipped.map((s) => `${s.outlet} – ${s.reason}`).join(', ')})`
  } catch (e) {
    back(`만들지 못했습니다: ${e instanceof Error ? e.message : String(e)}`, 'error')
  }
  revalidatePath('/support', 'layout')
  back(msg)
}
