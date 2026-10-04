'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

export type TrialRole = 'reporter' | 'editor' | 'group'

// 체험 계정: 기자 · 편집장 · 그룹장 역할을 바꿔 가며 써 본다 (trial.sql 의 trial_switch_role)
export async function switchTrialRole(r: TrialRole): Promise<{ error?: string }> {
  const { supabase, trial } = await getCmsContext()
  if (!trial) return { error: '체험 계정만 역할을 바꿀 수 있습니다.' }
  const { error } = await supabase.rpc('trial_switch_role', { r })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}
