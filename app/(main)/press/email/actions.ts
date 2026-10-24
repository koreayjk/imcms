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

export type OutletLimit = { outlet_id: string; outlet_name: string; daily_limit: number; is_custom: boolean; used_today: number; dropped_today: number }

// 총관리자: 언론사별 하루 한도 목록 (press-email-limits.sql 실행 전이면 null)
export async function getOutletLimits(): Promise<OutletLimit[] | null> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return null
  const { data, error } = await supabase.rpc('admin_press_mail_limits')
  if (error) return null
  return (data ?? []) as OutletLimit[]
}

export async function saveOutletLimit(outletId: string, limit: number | null): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) return { error: '총관리자만 바꿀 수 있습니다.' }
  if (limit !== null && (!Number.isInteger(limit) || limit < 0 || limit > 2000)) return { error: '하루 한도는 0~2000 사이의 숫자로 적어 주세요.' }
  const { error } = await supabase.rpc('admin_set_press_mail_limit', { p_outlet: outletId, p_limit: limit })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}
