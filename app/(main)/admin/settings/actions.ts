'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

export type SettingsState = { error?: string; ok?: string }

// 언론사 대표 이메일 (기자명 옆에 붙는 기본 이메일)
export async function saveContactEmail(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return { error: '편집장·발행인만 바꿀 수 있습니다.' }
  if (!outletId) return { error: '작업할 매체를 먼저 골라 주세요.' }
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '이메일 주소를 확인해 주세요.' }
  const { error } = await supabase.rpc('set_outlet_contact_email', { o: outletId, p_email: email })
  if (error) return { error: /set_outlet_contact_email/.test(error.message) ? 'Supabase에서 newsroom-settings.sql을 먼저 실행해 주세요.' : error.message }
  revalidatePath('/admin/settings')
  return { ok: email ? '저장했습니다. 앞으로 기자들의 기사에 이 이메일이 붙습니다.' : '대표 이메일을 비웠습니다.' }
}

// 기자별 월 AI 초안 한도 (빈 칸 = 자동 배분)
export async function saveMemberLimit(memberId: string, value: string): Promise<SettingsState> {
  const { supabase, outletId } = await getCmsContext()
  if (!outletId) return { error: '작업할 매체를 먼저 골라 주세요.' }
  const v = value.trim()
  const lim = v === '' ? null : Number(v)
  if (lim != null && (!Number.isInteger(lim) || lim < 0)) return { error: '0 이상의 숫자로 적어 주세요.' }
  const { error } = await supabase.rpc('set_member_ai_limit', { o: outletId, member: memberId, lim })
  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  return { ok: '저장했습니다.' }
}
