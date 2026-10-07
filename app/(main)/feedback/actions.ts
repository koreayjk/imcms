'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { feedbackMissing, isFeedbackCategory, isFeedbackStatus } from '@/lib/feedback'

// 개선 요청: 누가 무엇을 할 수 있는지는 DB(feedback.sql)가 다시 확인한다
//   글·댓글 쓰기: 모두 / 상태: 운영팀(총관리자·매니저) / 고치기·지우기: 쓴 사람과 총관리자
type Result = { ok?: true; id?: string; error?: string }

const fail = (e: { message: string } | null, what: string): Result =>
  ({ error: feedbackMissing(e?.message) ? '개선 요청을 쓰려면 총관리자가 feedback.sql을 실행해야 합니다.' : `${what}: ${e?.message ?? '권한이 없습니다.'}` })

function clean(input: { category?: string; title?: string; body?: string }) {
  const title = (input.title ?? '').trim().slice(0, 120)
  const body = (input.body ?? '').trim().slice(0, 5000)
  if (!title) return { error: '제목을 적어 주세요.' }
  if (!body) return { error: '내용을 적어 주세요.' }
  return { title, body, category: isFeedbackCategory(input.category) ? input.category : 'improve' }
}

export async function createFeedback(input: { category: string; title: string; body: string }): Promise<Result> {
  const { supabase } = await getCmsContext()
  const v = clean(input)
  if ('error' in v) return v
  const { data, error } = await supabase.from('feedback_posts').insert(v).select('id').single()
  if (error || !data) return fail(error, '올리지 못했습니다')
  revalidatePath('/feedback', 'layout')
  return { ok: true, id: data.id }
}

export async function updateFeedback(id: string, input: { category: string; title: string; body: string }): Promise<Result> {
  const { supabase, user, isSuper } = await getCmsContext()
  const v = clean(input)
  if ('error' in v) return v
  let q = supabase.from('feedback_posts').update(v).eq('id', id)
  if (!isSuper) q = q.eq('author_id', user.id)
  const { data, error } = await q.select('id')
  if (error || !data?.length) return fail(error, '고치지 못했습니다')
  revalidatePath('/feedback', 'layout')
  return { ok: true }
}

export async function deleteFeedback(id: string): Promise<Result> {
  const { supabase, user, isSuper } = await getCmsContext()
  let q = supabase.from('feedback_posts').delete().eq('id', id)
  if (!isSuper) q = q.eq('author_id', user.id)
  const { data, error } = await q.select('id')
  if (error || !data?.length) return fail(error, '지우지 못했습니다')
  revalidatePath('/feedback', 'layout')
  return { ok: true }
}

export async function setFeedbackStatus(id: string, status: string): Promise<Result> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '상태는 운영팀만 바꿀 수 있습니다.' }
  if (!isFeedbackStatus(status)) return { error: '없는 상태입니다.' }
  const { data, error } = await supabase.from('feedback_posts').update({ status }).eq('id', id).select('id')
  if (error || !data?.length) return fail(error, '상태를 바꾸지 못했습니다')
  revalidatePath('/feedback', 'layout')
  return { ok: true }
}

export async function addFeedbackComment(postId: string, body: string): Promise<Result> {
  const { supabase } = await getCmsContext()
  const text = body.trim().slice(0, 3000)
  if (!text) return { error: '댓글을 적어 주세요.' }
  const { data, error } = await supabase.from('feedback_comments').insert({ post_id: postId, body: text }).select('id').single()
  if (error || !data) return fail(error, '댓글을 올리지 못했습니다')
  revalidatePath(`/feedback/${postId}`)
  revalidatePath('/feedback')
  return { ok: true, id: data.id }
}

export async function updateFeedbackComment(id: string, body: string): Promise<Result> {
  const { supabase, user, isSuper } = await getCmsContext()
  const text = body.trim().slice(0, 3000)
  if (!text) return { error: '댓글을 적어 주세요.' }
  let q = supabase.from('feedback_comments').update({ body: text }).eq('id', id)
  if (!isSuper) q = q.eq('author_id', user.id)
  const { data, error } = await q.select('post_id')
  if (error || !data?.length) return fail(error, '댓글을 고치지 못했습니다')
  revalidatePath(`/feedback/${data[0].post_id}`)
  return { ok: true }
}

export async function deleteFeedbackComment(id: string): Promise<Result> {
  const { supabase, user, isSuper } = await getCmsContext()
  let q = supabase.from('feedback_comments').delete().eq('id', id)
  if (!isSuper) q = q.eq('author_id', user.id)
  const { data, error } = await q.select('post_id')
  if (error || !data?.length) return fail(error, '댓글을 지우지 못했습니다')
  revalidatePath(`/feedback/${data[0].post_id}`)
  revalidatePath('/feedback')
  return { ok: true }
}
