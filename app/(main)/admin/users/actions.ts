'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import type { UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['reporter', 'editor', 'admin']

async function adminContext() {
  const ctx = await getCmsContext()
  if (ctx.profile?.role !== 'admin') redirect('/newsroom')
  return ctx
}

function fail(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`)
}

export async function approveUser(id: string, form: FormData) {
  const { supabase } = await adminContext()
  const role = String(form.get('role') ?? 'reporter') as UserRole
  const outletId = String(form.get('outlet_id') ?? '') || null
  if (!ROLES.includes(role)) fail('역할을 확인해 주세요.')
  if (!outletId && role !== 'admin') fail('소속 매체를 정해주세요.')

  const { error } = await supabase.from('profiles').update({ approved: true, role, outlet_id: outletId }).eq('id', id)
  if (error) fail(`승인하지 못했습니다: ${error.message}`)
  revalidatePath('/admin/users', 'layout')
}

export async function rejectUser(id: string) {
  const { supabase } = await adminContext()
  const { error } = await supabase.rpc('admin_reject_user', { target: id })
  if (error) fail(`거절하지 못했습니다: ${error.message}`)
  revalidatePath('/admin/users', 'layout')
}
