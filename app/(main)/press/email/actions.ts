'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { PRESS_MAIL_ADDON_FEE } from '@/lib/pricing'

export type MyInbox = {
  address: string | null
  verify_code: string | null
  verify_link: string | null
  verify_at: string | null
  last_received_at: string | null
  received_count: number
  // press-email-limits.sql 실행 전에는 없다 (우리 언론사의 오늘 한도·사용량·못 받은 건수)
  daily_limit?: number
  used_today?: number
  dropped_today?: number
  // press-email-addon.sql 실행 전에는 없다 (없으면 모두 받는 것으로 본다)
  mail_on?: boolean // 부가 서비스를 켰거나 프리미엄 등 기본 포함
  included?: boolean // 요금제에 포함
  trial_left?: number // 남은 체험 메일 수
  dropped_week?: number // 최근 7일 동안 받지 못한 메일 수
}

export async function getMyInbox(): Promise<{ inbox: MyInbox | null; error?: string }> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.rpc('my_press_inbox')
  if (error) return { inbox: null, error: error.message }
  return { inbox: (Array.isArray(data) ? data[0] : data) ?? null }
}

export type AddressState = { ok?: boolean; error?: string }

export async function saveMailAddress(_prev: AddressState, form: FormData): Promise<AddressState> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return { error: '총관리자만 바꿀 수 있습니다.' }
  const address = String(form.get('address') ?? '').trim()
  const { error } = await supabase.rpc('admin_set_press_mail_address', { p_address: address })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}

export type OutletLimit = { outlet_id: string; outlet_name: string; plan: string; plan_limit: number; daily_limit: number; is_custom: boolean; used_today: number; dropped_today: number; addon?: boolean; included?: boolean; trial_used?: number; dropped_week?: number }
export type PlanLimit = { plan: 'basic' | 'standard' | 'premium' | 'other'; daily_limit: number }

// 총관리자: 요금제별 기본 한도 + 언론사별 한도 목록 (press-email-limits.sql 실행 전이면 null)
export async function getMailLimits(): Promise<{ outlets: OutletLimit[]; plans: PlanLimit[] } | null> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return null
  const [o, p] = await Promise.all([supabase.rpc('admin_press_mail_limits'), supabase.rpc('admin_press_mail_plan_limits')])
  if (o.error || p.error) return null
  return { outlets: (o.data ?? []) as OutletLimit[], plans: (p.data ?? []) as PlanLimit[] }
}

const okLimit = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0 && n <= 2000)

export async function saveOutletLimit(outletId: string, limit: number | null): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return { error: '총관리자만 바꿀 수 있습니다.' }
  if (!okLimit(limit)) return { error: '하루 한도는 0~2000 사이의 숫자로 적어 주세요.' }
  const { error } = await supabase.rpc('admin_set_press_mail_limit', { p_outlet: outletId, p_limit: limit })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}

export async function savePlanLimit(plan: PlanLimit['plan'], limit: number): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return { error: '총관리자만 바꿀 수 있습니다.' }
  if (!okLimit(limit) || limit === null) return { error: '하루 한도는 0~2000 사이의 숫자로 적어 주세요.' }
  const { error } = await supabase.rpc('admin_set_press_mail_plan_limit', { p_plan: plan, p_limit: limit })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}

// 총관리자: 보도자료 메일 자동 수신 부가 서비스 켜고 끄기 (월 39,000원, 다음 청구서부터 항목이 들어감)
export async function saveOutletAddon(outletId: string, on: boolean): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return { error: '총관리자만 바꿀 수 있습니다.' }
  const { error } = await supabase.rpc('admin_set_press_mail_addon', { p_outlet: outletId, p_on: on })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}

// 기자·발행인: 부가 서비스 신청 (고객센터 "계약·요금" 요청으로 접수된다. 같은 요청이 열려 있으면 새로 만들지 않는다)
const ADDON_TITLE = `부가 서비스 신청: 보도자료 메일 자동 수신 (월 ${PRESS_MAIL_ADDON_FEE.toLocaleString('ko-KR')}원)`
export async function requestPressAddon(): Promise<{ ok?: boolean; already?: boolean; error?: string }> {
  const { supabase, user, outletId, profile } = await getCmsContext()
  if (!outletId) return { error: '소속 매체가 없어 신청할 수 없습니다.' }
  const { data: open } = await supabase.from('support_tickets').select('id').eq('outlet_id', outletId).eq('title', ADDON_TITLE).neq('status', 'done').limit(1)
  if (open?.length) return { ok: true, already: true }
  const { data: o } = await supabase.from('outlets').select('name').eq('id', outletId).maybeSingle()
  const body = `${(o as { name?: string } | null)?.name ?? '우리 매체'}에서 "보도자료 메일 자동 수신" 부가 서비스를 신청합니다.\n\n- 메일로 온 보도자료를 보도자료함으로 자동 수신, 첨부(한글·워드·PDF·텍스트) 내용 자동 입력\n- 월 ${PRESS_MAIL_ADDON_FEE.toLocaleString('ko-KR')}원, 다음 청구서부터 부가 항목으로 청구\n\n신청자: ${profile?.full_name ?? ''}`
  const { error } = await supabase.from('support_tickets').insert({ category: 'billing', title: ADDON_TITLE, body, requester_id: user.id, outlet_id: outletId })
  if (error) return { error: `신청을 저장하지 못했습니다: ${error.message}` }
  revalidatePath('/support', 'layout')
  return { ok: true }
}
