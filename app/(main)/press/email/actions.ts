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
}

export async function getMyInbox(): Promise<{ inbox: MyInbox | null; error?: string }> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.rpc('my_press_inbox')
  if (error) return { inbox: null, error: error.message }
  return { inbox: (Array.isArray(data) ? data[0] : data) ?? null }
}

export type AddressState = { ok?: boolean; error?: string }

export async function saveMailAddress(_prev: AddressState, form: FormData): Promise<AddressState> {
  const { supabase, profile } = await getCmsContext()
  if (profile?.role !== 'admin') return { error: '관리자만 바꿀 수 있습니다.' }
  const address = String(form.get('address') ?? '').trim()
  const { error } = await supabase.rpc('admin_set_press_mail_address', { p_address: address })
  if (error) return { error: error.message }
  revalidatePath('/press/email')
  return { ok: true }
}
