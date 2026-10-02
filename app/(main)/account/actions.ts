'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

export type NameState = { ok?: boolean; error?: string }

export async function updateMyName(_prev: NameState, form: FormData): Promise<NameState> {
  const { supabase, user } = await getCmsContext()
  const name = String(form.get('full_name') ?? '').trim().replace(/\s+/g, ' ')
  if (!name) return { error: '이름을 적어주세요.' }
  if (name.length > 30) return { error: '이름은 30자까지 쓸 수 있습니다.' }

  const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id)
  if (error) return { error: `바꾸지 못했습니다: ${error.message}` }
  revalidatePath('/', 'layout')
  return { ok: true }
}

// 발행인·총관리자: 작업할 매체 바꾸기 (DB가 자기 그룹 매체인지 확인한다)
export async function switchOutlet(outletId: string): Promise<{ error?: string }> {
  const { supabase, user, isGroupAdmin } = await getCmsContext()
  // 기자·편집장: 소속된 매체로만, 그 매체의 직급으로 바뀐다 (DB 함수가 확인)
  if (!isGroupAdmin) {
    const { error } = await supabase.rpc('switch_my_outlet', { o: outletId })
    if (error) return { error: /switch_my_outlet/.test(error.message) ? '매체를 바꿀 권한이 없습니다.' : error.message }
    revalidatePath('/', 'layout')
    return {}
  }
  const { error } = await supabase.from('profiles').update({ outlet_id: outletId }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}
