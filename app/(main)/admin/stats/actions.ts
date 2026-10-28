'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

// 편집국 통계 화면의 실시간 댓글 칸: 목록 읽기와 승인·숨기기·삭제·차단·답글 (편집장 이상. 권한은 DB 규칙이 다시 확인한다)
export type FeedRow = {
  id: string; body: string; status: 'pending' | 'approved' | 'rejected'; report_count: number; created_at: string
  hold_reason: string | null; guest_name: string | null; ip_hash: string | null; outlet_id: string
  article: { id: string; title: string } | null
  reader: { id: string; name: string | null; email: string; banned: boolean } | null
  outlet: { name: string } | null
  replies: { id: string; body: string; created_at: string; staff_name: string | null }[]
}
export type FeedTab = 'new' | 'all'
type Result = { ok?: boolean; error?: string }

async function ctx() {
  const c = await getCmsContext()
  const { t } = await getT()
  if (!c.isEditorPlus && !c.isStaff) throw new Error(t('편집장 이상만 쓸 수 있습니다.', 'Only editors and above can do this.'))
  return { ...c, t }
}

const COLS = 'id, body, status, report_count, created_at, hold_reason, guest_name, ip_hash, outlet_id, article:articles(id, title), reader:readers(id, name, email, banned), outlet:outlets(name)'

export async function fetchFeed(tab: FeedTab): Promise<{ rows: FeedRow[]; pending: number; error?: boolean }> {
  const { supabase, outletId } = await ctx()
  const run = async (cols: string, withReplies: boolean) => {
    let q = supabase.from('comments').select(cols)
    if (outletId) q = q.eq('outlet_id', outletId)
    if (withReplies) q = q.is('parent_id', null).eq('staff_reply', false)
    q = tab === 'new' ? q.eq('status', 'pending') : q.neq('status', 'rejected')
    return q.order('created_at', { ascending: false }).limit(40)
  }
  let hasReplies = true
  let res = await run(`${COLS}, parent_id, staff_reply`, true)
  // comment-replies.sql 을 아직 실행하지 않았으면 답글 칸 없이 읽는다
  if (res.error) { hasReplies = false; res = await run(COLS, false) }
  if (res.error) return { rows: [], pending: 0, error: true }
  const data = res.data
  let pc = supabase.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (outletId) pc = pc.eq('outlet_id', outletId)
  const { count } = await pc
  const rows = ((data ?? []) as unknown as Omit<FeedRow, 'replies'>[]).map((r) => ({ ...r, replies: [] as FeedRow['replies'] }))
  if (hasReplies && rows.length) {
    const { data: reps } = await supabase.from('comments').select('id, parent_id, body, created_at, guest_name').in('parent_id', rows.map((r) => r.id)).eq('staff_reply', true).order('created_at')
    for (const rp of (reps ?? []) as { id: string; parent_id: string; body: string; created_at: string; guest_name: string | null }[]) {
      rows.find((r) => r.id === rp.parent_id)?.replies.push({ id: rp.id, body: rp.body, created_at: rp.created_at, staff_name: rp.guest_name })
    }
  }
  return { rows, pending: count ?? 0 }
}

export async function approveFeed(id: string): Promise<Result> {
  const { supabase, user } = await ctx()
  const { error } = await supabase.from('comments').update({ status: 'approved', decided_at: new Date().toISOString(), decided_by: user.id }).eq('id', id)
  revalidatePath('/admin/comments')
  return error ? { error: error.message } : { ok: true }
}

export async function hideFeed(id: string): Promise<Result> {
  const { supabase, user } = await ctx()
  const { error } = await supabase.from('comments').update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id }).eq('id', id)
  revalidatePath('/admin/comments')
  return error ? { error: error.message } : { ok: true }
}

export async function deleteFeed(id: string): Promise<Result> {
  const { supabase } = await ctx()
  const { error } = await supabase.from('comments').delete().eq('id', id)
  revalidatePath('/admin/comments')
  return error ? { error: error.message } : { ok: true }
}

export async function banReaderFeed(readerId: string): Promise<Result> {
  const { supabase, user } = await ctx()
  await supabase.from('readers').update({ banned: true }).eq('id', readerId)
  await supabase.from('comments').update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id }).eq('reader_id', readerId).neq('status', 'rejected')
  revalidatePath('/admin/comments')
  return { ok: true }
}

export async function banGuestFeed(outletId: string, ipHash: string): Promise<Result> {
  const { supabase, user } = await ctx()
  await supabase.from('comment_blocked_ips').upsert({ outlet_id: outletId, ip_hash: ipHash })
  await supabase.from('comments').update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id }).eq('outlet_id', outletId).eq('ip_hash', ipHash).neq('status', 'rejected')
  revalidatePath('/admin/comments')
  return { ok: true }
}

// 편집국 답글: 바로 공개되고 "편집국" 표시가 붙는다. 답글을 달면 원 댓글도 함께 공개된다 (comment-replies.sql)
export async function replyFeed(parentId: string, text: string): Promise<Result> {
  const { supabase, user, profile, t } = await ctx()
  const body = text.trim()
  if (!body) return { error: t('답글 내용을 적어 주세요.', 'Please write a reply.') }
  if (body.length > 500) return { error: t('답글은 500자까지 쓸 수 있습니다.', 'Replies can be up to 500 characters.') }
  const { data: parent } = await supabase.from('comments').select('id, article_id, outlet_id, status').eq('id', parentId).maybeSingle()
  if (!parent) return { error: t('댓글을 찾지 못했습니다.', 'Comment not found.') }
  const name = String((profile as { full_name?: string | null } | null)?.full_name ?? '').trim().slice(0, 30) || t('편집국', 'Newsroom')
  const now = new Date().toISOString()
  const { error } = await supabase.from('comments').insert({
    outlet_id: parent.outlet_id, article_id: parent.article_id, reader_id: null, guest_name: name, body,
    status: 'approved', staff_reply: true, parent_id: parent.id, decided_at: now, decided_by: user.id,
  })
  if (error) {
    return { error: /parent_id|staff_reply|column/i.test(error.message) ? t('답글을 쓰려면 운영팀이 Supabase에서 comment-replies.sql을 먼저 실행해야 합니다.', 'To reply, the operations team must run comment-replies.sql in Supabase first.') : error.message }
  }
  if (parent.status !== 'approved') await supabase.from('comments').update({ status: 'approved', decided_at: now, decided_by: user.id }).eq('id', parent.id)
  revalidatePath('/admin/comments')
  return { ok: true }
}
