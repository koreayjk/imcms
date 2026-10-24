'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

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

export type OutletLimit = { outlet_id: string; outlet_name: string; plan: string; plan_limit: number; daily_limit: number; is_custom: boolean; used_today: number; dropped_today: number }
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
