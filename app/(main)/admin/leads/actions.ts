'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

const STATUSES = ['new', 'contacted', 'done']

export async function setLeadStatus(id: string, status: string) {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) redirect('/newsroom')
  if (!STATUSES.includes(status)) return
  await supabase.from('beta_requests').update({ status }).eq('id', id)
  revalidatePath('/admin/leads')
}
