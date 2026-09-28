import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './supabase-server'
import type { UserRole } from './types'

export async function getCmsContext() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, outlet_id')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'reporter') as UserRole
  return {
    supabase,
    user,
    profile,
    outletId: (profile?.outlet_id as string | null) ?? null,
    isEditorPlus: role === 'editor' || role === 'admin',
  }
}
