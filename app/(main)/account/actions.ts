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
