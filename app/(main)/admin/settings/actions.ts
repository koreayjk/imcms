'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

export type SettingsState = { error?: string; ok?: string }

// 언론사 대표 이메일 (기자명 옆에 붙는 기본 이메일)
export async function saveContactEmail(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isEditorPlus && !isStaff) return { error: t('편집장·발행인만 바꿀 수 있습니다.', 'Only Editors-in-Chief and Publishers can change this.') }
  if (!outletId) return { error: t('작업할 매체를 먼저 골라 주세요.', 'Choose an outlet to work on first.') }
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t('이메일 주소를 확인해 주세요.', 'Check the email address.') }
  const { error } = await supabase.rpc('set_outlet_contact_email', { o: outletId, p_email: email })
  if (error) return { error: /set_outlet_contact_email/.test(error.message) ? t('Supabase에서 newsroom-settings.sql을 먼저 실행해 주세요.', 'Run newsroom-settings.sql in Supabase first.') : error.message }
  revalidatePath('/admin/settings')
  return { ok: email ? t('저장했습니다. 앞으로 기자들의 기사에 이 이메일이 붙습니다.', 'Saved. This email will now appear on reporters\' stories.') : t('대표 이메일을 비웠습니다.', 'Cleared the outlet contact email.') }
}

// 기자별 월 AI 사용 한도 (초안·법적 검수 합계, 빈 칸 = 자동 배분)
export async function saveMemberLimit(memberId: string, value: string): Promise<SettingsState> {
  const { supabase, outletId } = await getCmsContext()
  const { t } = await getT()
  if (!outletId) return { error: t('작업할 매체를 먼저 골라 주세요.', 'Choose an outlet to work on first.') }
  const v = value.trim()
  const lim = v === '' ? null : Number(v)
  if (lim != null && (!Number.isInteger(lim) || lim < 0)) return { error: t('0 이상의 숫자로 적어 주세요.', 'Enter a number that is 0 or greater.') }
  const { error } = await supabase.rpc('set_member_ai_limit', { o: outletId, member: memberId, lim })
  if (error) return { error: error.message }
  revalidatePath('/admin/settings')
  return { ok: t('저장했습니다.', 'Saved.') }
}
