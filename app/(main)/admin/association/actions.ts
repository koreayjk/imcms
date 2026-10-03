'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

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
  const { error } = await supabase.from('gdpa_members').update({ status, updated_at: new Date().toISOString() }).eq('user_id', userId)
  if (error) return { error: error.message }
  done()
  return { ok: '바꿨습니다.' }
}

export async function savePost(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await staff()
  const id = String(form.get('id') ?? '')
  const board = String(form.get('board') ?? '')
  const title = String(form.get('title') ?? '').trim().slice(0, 200)
  const body = String(form.get('body') ?? '').trim().slice(0, 30000)
  if (!['notice', 'activity', 'data'].includes(board)) return { error: '게시판을 고르세요.' }
  if (!title) return { error: '제목을 적어 주세요.' }
  const row = { board, title, body, pinned: form.get('pinned') === 'on', published: form.get('published') !== 'off', updated_at: new Date().toISOString() }
  const { error } = id ? await supabase.from('gdpa_posts').update(row).eq('id', id) : await supabase.from('gdpa_posts').insert(row)
  if (error) return { error: /gdpa_posts/.test(error.message) ? 'Supabase에서 gdpa.sql을 먼저 실행해 주세요.' : error.message }
  done()
  return { ok: id ? '고쳤습니다.' : '올렸습니다. 협회 홈페이지에 바로 보입니다.' }
}

export async function deletePost(id: string): Promise<FormState> {
  const { supabase } = await staff()
  const { error } = await supabase.from('gdpa_posts').delete().eq('id', id)
  if (error) return { error: error.message }
  done()
  return { ok: '지웠습니다.' }
}

export async function addMemberOutlet(outletId: string): Promise<FormState> {
  const { supabase } = await staff()
  const { count } = await supabase.from('gdpa_member_outlets').select('outlet_id', { count: 'exact', head: true })
  const { error } = await supabase.from('gdpa_member_outlets').insert({ outlet_id: outletId, sort_order: (count ?? 0) + 1 })
  if (error) return { error: /duplicate/.test(error.message) ? '이미 회원사입니다.' : error.message }
  done()
  return { ok: '회원사로 넣었습니다.' }
}

export async function removeMemberOutlet(outletId: string): Promise<FormState> {
  const { supabase } = await staff()
  const { error } = await supabase.from('gdpa_member_outlets').delete().eq('outlet_id', outletId)
  if (error) return { error: error.message }
  done()
  return { ok: '회원사에서 뺐습니다.' }
}
