'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { planById } from '@/lib/pricing'

export type PlanState = { error?: string; ok?: string }

// 매체 요금제·AI 한도 정하기 (운영팀만 — outlets 수정 권한도 운영팀뿐)
export async function setOutletPlan(id: string, input: { plan: string; limit: string; overage: boolean }): Promise<PlanState> {
  const { supabase, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) return { error: t('요금제는 IM 뉴스룸 운영팀만 바꿀 수 있습니다.', 'Only the IM Newsroom team can change plans.') }
  const plan = planById(input.plan)?.id ?? null
  const limitText = input.limit.trim()
  const limit = limitText === '' ? null : Number(limitText)
  if (limit != null && (!Number.isInteger(limit) || limit < 0 || limit > 1_000_000)) return { error: t('한도는 0 이상의 숫자로 적어주세요. 비우면 요금제 기본값입니다.', 'Enter the limit as a number of 0 or more. Leave blank for the plan default.') }
  if (plan === 'enterprise' && limit == null) return { error: t('엔터프라이즈는 월 한도를 직접 적어주세요.', 'Enter the monthly limit for Enterprise.') }
  const { error, data } = await supabase.from('outlets').update({ plan, ai_monthly_limit: limit, ai_overage: input.overage }).eq('id', id).select('id')
  if (error) return { error: /plan|ai_monthly_limit|ai_overage/.test(error.message) ? t('Supabase에서 supabase/ai-usage.sql을 먼저 실행해 주세요.', 'Run supabase/ai-usage.sql in Supabase first.') : error.message }
  if (!data?.length) return { error: t('저장 권한이 없습니다.', 'You do not have permission to save.') }
  revalidatePath('/admin/ai-usage')
  return { ok: t('저장했습니다.', 'Saved.') }
}
