'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { planById } from '@/lib/pricing'

export type PlanState = { error?: string; ok?: string }

// 매체 요금제·AI 한도 정하기 (운영팀만 — outlets 수정 권한도 운영팀뿐)
export async function setOutletPlan(id: string, input: { plan: string; limit: string; overage: boolean }): Promise<PlanState> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '요금제는 IM 뉴스룸 운영팀만 바꿀 수 있습니다.' }
  const plan = planById(input.plan)?.id ?? null
  const limitText = input.limit.trim()
  const limit = limitText === '' ? null : Number(limitText)
  if (limit != null && (!Number.isInteger(limit) || limit < 0 || limit > 1_000_000)) return { error: '한도는 0 이상의 숫자로 적어주세요. 비우면 요금제 기본값입니다.' }
  if (plan === 'enterprise' && limit == null) return { error: '엔터프라이즈는 월 한도를 직접 적어주세요.' }
  const { error, data } = await supabase.from('outlets').update({ plan, ai_monthly_limit: limit, ai_overage: input.overage }).eq('id', id).select('id')
  if (error) return { error: /plan|ai_monthly_limit|ai_overage/.test(error.message) ? 'Supabase에서 supabase/ai-usage.sql을 먼저 실행해 주세요.' : error.message }
  if (!data?.length) return { error: '저장 권한이 없습니다.' }
  revalidatePath('/admin/ai-usage')
  return { ok: '저장했습니다.' }
}
