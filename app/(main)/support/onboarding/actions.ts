'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { ONBOARDING_STEPS } from '@/lib/onboarding-guide'

export type CommentResult = { error?: string; comment?: { id: string; step_id: string | null; author_name: string; from_staff: boolean; body: string; created_at: string } }

const STEP_IDS = ONBOARDING_STEPS.map((s) => s.id)

// 개통 진행 현황 코멘트 쓰기: 고객은 자기 매체, 운영팀은 어느 매체든 (launch-hub.sql)
export async function addLaunchComment(outletId: string, stepId: string | null, body: string): Promise<CommentResult> {
  const { supabase, user, profile, isStaff } = await getCmsContext()
  const { t } = await getT()
  const text = body.trim().slice(0, 2000)
  if (!text) return { error: t('내용을 적어 주세요.', 'Please write something.') }
  if (!/^[0-9a-f-]{36}$/.test(outletId)) return { error: t('매체를 확인해 주세요.', 'Please check the publication.') }
  if (stepId && !STEP_IDS.includes(stepId)) return { error: t('없는 단계입니다.', 'Unknown step.') }
  const name = (profile?.full_name as string | undefined)?.trim() || user.email || ''
  const { data, error } = await supabase.from('launch_comments')
    .insert({ outlet_id: outletId, step_id: stepId, author_id: user.id, author_name: name, from_staff: isStaff, body: text })
    .select('id, step_id, author_name, from_staff, body, created_at').single()
  if (error || !data) return { error: /launch_comments/.test(error?.message ?? '') ? t('코멘트를 쓰려면 launch-hub.sql을 실행해 주세요.', 'Run launch-hub.sql to use comments.') : error?.message ?? t('저장하지 못했습니다.', 'Could not save.') }
  revalidatePath('/', 'layout')
  return { comment: data }
}

// 운영팀: 코멘트 지우기
export async function deleteLaunchComment(id: string): Promise<{ error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) return { error: t('운영팀만 지울 수 있습니다.', 'Only the IM Newsroom team can delete this.') }
  const { error } = await supabase.from('launch_comments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

// 개통 현황을 열었다고 표시: 운영팀은 이 매체의 고객 글을 봤다고, 고객은 새 소식을 확인했다고 기록한다 (메뉴의 숫자가 지워진다)
export async function markLaunchSeen(outletId: string): Promise<void> {
  const { supabase, isStaff } = await getCmsContext()
  if (!/^[0-9a-f-]{36}$/.test(outletId)) return
  if (isStaff) await supabase.from('launch_comments').update({ staff_seen: true }).eq('outlet_id', outletId).eq('from_staff', false).eq('staff_seen', false)
  else await supabase.rpc('launch_mark_seen', { o: outletId })
  revalidatePath('/', 'layout')
}
