'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

export type FormState = { error?: string; ok?: string }

// 협회(GDPA) 관리는 IM 뉴스룸 운영팀만
async function staff() {
  const ctx = await getCmsContext()
  if (!ctx.isStaff) redirect('/newsroom')
  return ctx
}
const done = () => { revalidatePath('/admin/association'); revalidatePath('/gdpa', 'layout') }

export async function setMemberStatus(userId: string, status: 'approved' | 'rejected' | 'pending'): Promise<FormState> {
  const { supabase } = await staff()
  const { t } = await getT()
  const { error } = await supabase.from('gdpa_members').update({ status, updated_at: new Date().toISOString() }).eq('user_id', userId)
  if (error) return { error: error.message }
  done()
  return { ok: t('바꿨습니다.', 'Updated.') }
}

export async function savePost(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await staff()
  const { t } = await getT()
  const id = String(form.get('id') ?? '')
  const board = String(form.get('board') ?? '')
  const title = String(form.get('title') ?? '').trim().slice(0, 200)
  const body = String(form.get('body') ?? '').trim().slice(0, 30000)
  if (!['notice', 'activity', 'data'].includes(board)) return { error: t('게시판을 고르세요.', 'Choose a board.') }
  if (!title) return { error: t('제목을 적어 주세요.', 'Enter a title.') }
  const row = { board, title, body, pinned: form.get('pinned') === 'on', published: form.get('published') !== 'off', updated_at: new Date().toISOString() }
  const { error } = id ? await supabase.from('gdpa_posts').update(row).eq('id', id) : await supabase.from('gdpa_posts').insert(row)
  if (error) return { error: /gdpa_posts/.test(error.message) ? t('Supabase에서 gdpa.sql을 먼저 실행해 주세요.', 'Run gdpa.sql in Supabase first.') : error.message }
  done()
  return { ok: id ? t('고쳤습니다.', 'Saved.') : t('올렸습니다. 협회 홈페이지에 바로 보입니다.', 'Posted. It is now live on the association website.') }
}

export async function deletePost(id: string): Promise<FormState> {
  const { supabase } = await staff()
  const { t } = await getT()
  const { error } = await supabase.from('gdpa_posts').delete().eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: t('지웠습니다.', 'Deleted.') }
}

export async function addMemberOutlet(outletId: string): Promise<FormState> {
  const { supabase } = await staff()
  const { t } = await getT()
  const { count } = await supabase.from('gdpa_member_outlets').select('outlet_id', { count: 'exact', head: true })
  const { error } = await supabase.from('gdpa_member_outlets').insert({ outlet_id: outletId, sort_order: (count ?? 0) + 1 })
  if (error) return { error: /duplicate/.test(error.message) ? t('이미 회원사입니다.', 'Already a member outlet.') : error.message }
  done()
  return { ok: t('회원사로 넣었습니다.', 'Added as a member outlet.') }
}

export async function removeMemberOutlet(outletId: string): Promise<FormState> {
  const { supabase } = await staff()
  const { t } = await getT()
  const { error } = await supabase.from('gdpa_member_outlets').delete().eq('outlet_id', outletId)
  if (error) return { error: error.message }
  done()
  return { ok: t('회원사에서 뺐습니다.', 'Removed from member outlets.') }
}
