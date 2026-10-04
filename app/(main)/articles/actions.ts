'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { refreshOutlets } from './refresh'

// 본인 기사 또는 편집장·관리자만 삭제. 함께 송고된 다른 매체 사본도 같이 내린다
export async function deleteArticle(id: string) {
  const { supabase, user, isEditorPlus } = await getCmsContext()

  const { data: article } = await supabase.from('articles').select('id, author_id, outlet_id').eq('id', id).maybeSingle()
  if (!article) redirect('/articles')
  if (article.author_id !== user.id && !isEditorPlus) {
    redirect(`/articles/${id}?error=${encodeURIComponent('본인이 쓴 기사만 삭제할 수 있습니다.')}`)
  }

  // 함께 송고된 사본이 있는 매체 (홈페이지 캐시를 지우려고 미리 알아 둔다)
  const { data: copies } = await supabase.from('articles').select('outlet_id').eq('source_article_id', id)
  // syndication.sql 실행 전이면 칸이 없어 조용히 실패한다 (사본도 없음)
  await supabase.from('articles').delete().eq('source_article_id', id)

  const { data: deleted, error } = await supabase.from('articles').delete().eq('id', id).select('id')
  if (error || !deleted?.length) {
    const reason = error?.message ?? '삭제 권한이 없습니다. 관리자에게 article-manage.sql 실행을 요청하세요.'
    redirect(`/articles/${id}?error=${encodeURIComponent(`삭제하지 못했습니다: ${reason}`)}`)
  }

  await refreshOutlets([article.outlet_id, ...((copies ?? []) as { outlet_id: string | null }[]).map((c) => c.outlet_id)])
  revalidatePath('/', 'layout')
  redirect('/articles?deleted=1')
}
