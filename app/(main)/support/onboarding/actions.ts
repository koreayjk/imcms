'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { ONBOARDING_STEPS } from '@/lib/onboarding-guide'

export type CommentResult = { error?: string; comment?: { id: string; step_id: string | null; author_name: string; from_staff: boolean; body: string; created_at: string } }

const STEP_IDS = ONBOARDING_STEPS.map((s) => s.id)

// 개통 진행 현황 코멘트 쓰기: 고객은 자기 매체, 운영팀은 어느 매체든 (launch-hub.sql)
export async function addLaunchComment(outletId: string, stepId: string | null, body: string): Promise<CommentResult> {
  const { supabase, user, profile, isStaff } = await getCmsContext()
  const text = body.trim().slice(0, 2000)
  if (!text) return { error: '내용을 적어 주세요.' }
  if (!/^[0-9a-f-]{36}$/.test(outletId)) return { error: '매체를 확인해 주세요.' }
  if (stepId && !STEP_IDS.includes(stepId)) return { error: '없는 단계입니다.' }
  const name = (profile?.full_name as string | undefined)?.trim() || user.email || ''
  const { data, error } = await supabase.from('launch_comments')
    .insert({ outlet_id: outletId, step_id: stepId, author_id: user.id, author_name: name, from_staff: isStaff, body: text })
    .select('id, step_id, author_name, from_staff, body, created_at').single()
  if (error || !data) return { error: /launch_comments/.test(error?.message ?? '') ? '코멘트를 쓰려면 launch-hub.sql을 실행해 주세요.' : error?.message ?? '저장하지 못했습니다.' }
  revalidatePath('/', 'layout')
  return { comment: data }
}

// 운영팀: 코멘트 지우기
export async function deleteLaunchComment(id: string): Promise<{ error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 지울 수 있습니다.' }
  const { error } = await supabase.from('launch_comments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

// 운영팀이 이 매체의 고객 글을 열어 봤다고 표시 (메뉴의 새 글 숫자가 줄어든다)
export async function markLaunchSeen(outletId: string): Promise<void> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff || !/^[0-9a-f-]{36}$/.test(outletId)) return
  await supabase.from('launch_comments').update({ staff_seen: true }).eq('outlet_id', outletId).eq('from_staff', false).eq('staff_seen', false)
  revalidatePath('/', 'layout')
}
