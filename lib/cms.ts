import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './supabase-server'
import type { UserRole } from './types'

export async function getCmsContext() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'reporter') as UserRole
  if (!isApproved(profile)) redirect('/pending')
  return {
    supabase,
    user,
    profile,
    outletId: (profile?.outlet_id as string | null) ?? null,
    isEditorPlus: role === 'editor' || role === 'admin',
  }
}

// 관리자 승인 전 가입자는 편집국에 들어올 수 없다 (DB에서도 막혀 있음)
export function isApproved(profile: { role?: string | null; approved?: boolean | null } | null) {
  if (!profile) return false
  return profile.role === 'admin' || profile.approved !== false
}
