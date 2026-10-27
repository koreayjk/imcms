'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

export type TrialRole = 'reporter' | 'editor' | 'group'

// 체험 계정: 기자 · 편집장 · 그룹장 역할을 바꿔 가며 써 본다 (trial.sql 의 trial_switch_role)
export async function switchTrialRole(r: TrialRole): Promise<{ error?: string }> {
  const { supabase, trial } = await getCmsContext()
  const { t } = await getT()
  if (!trial) return { error: t('체험 계정만 역할을 바꿀 수 있습니다.', 'Only trial accounts can switch roles.') }
  const { error } = await supabase.rpc('trial_switch_role', { r })
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}
