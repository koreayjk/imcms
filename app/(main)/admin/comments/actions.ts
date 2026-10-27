'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

// 댓글 승인·반려·삭제, 독자 차단 (편집장 이상. 권한은 DB 규칙이 다시 확인한다)
async function ctx() {
  const c = await getCmsContext()
  const { t } = await getT()
  if (!c.isEditorPlus && !c.isStaff) throw new Error(t('편집장 이상만 쓸 수 있습니다.', 'Only editors and above can do this.'))
  return { ...c, t }
}

export async function decideComment(id: string, status: 'approved' | 'rejected') {
  const { supabase, user } = await ctx()
  await supabase.from('comments').update({ status, decided_at: new Date().toISOString(), decided_by: user.id }).eq('id', id)
  revalidatePath('/admin/comments')
}

export async function deleteComment(id: string) {
  const { supabase } = await ctx()
  await supabase.from('comments').delete().eq('id', id)
  revalidatePath('/admin/comments')
}

// 독자 차단: 이 독자는 더 댓글을 쓸 수 없고 로그인도 막힌다. 이미 쓴 댓글은 반려로 돌린다
export async function banReader(readerId: string) {
  const { supabase, user } = await ctx()
  await supabase.from('readers').update({ banned: true }).eq('id', readerId)
  await supabase.from('comments').update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: user.id }).eq('reader_id', readerId).neq('status', 'rejected')
  revalidatePath('/admin/comments')
}
