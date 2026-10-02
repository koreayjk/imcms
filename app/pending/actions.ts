'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 승인 전 가입자가 소속 매체(신청 매체)를 정하거나 바꾼다
export async function changeRequestedOutlet(form: FormData) {
  const value = String(form.get('outlet') ?? '')
  const supabase = await createServerSupabaseClient()
  await supabase.rpc('set_requested_outlet', { o: /^[0-9a-f-]{36}$/.test(value) ? value : null })
  revalidatePath('/pending')
}
