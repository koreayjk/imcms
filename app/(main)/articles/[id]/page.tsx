import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ReviewActions from '@/components/ReviewActions'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, outlet_id')
    .eq('id', user.id)
    .single()

  const { data: article } = await supabase
    .from('articles')
    .select('*, author:profiles!articles_author_id_fkey(id, full_name, role), category:categories(name)')
    .eq('id', params.id)
    .single()

  if (!article) notFound()

  const isOwner = article.author_id === user.id
  const isEditorPlus = profile?.role === 'editor' || profile?.role === 'admin'
  const canEdit = isOwner || isEditorPlus
  const canReview = isEditorPlus && article.status === 'in_review'

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* 브레드크럼 */}
      <div className="mb-6 flex items-center gap-1.5 text-xs text-muted">
        <Link href="/articles" className="hover:text-ink">기사 목록</Link>
        <span>/</span>
        <span className="text-ink truncate max-w-xs">{article.title}</span>
      </div>

      {/* 기사 헤더 */}
      <article>
        <header className="mb-7 pb-6 border-b border-line">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold leading-snug flex-1">{article.title}</h1>
            <span className={`status-badge status-${article.status} shrink-0 mt-1.5 py-1 px-2`}>
              {STATUS_LABEL[article.status as ArticleStatus]}
            </span>
          </div>

          {article.excerpt && (
            <p className="mt-3 text-sm text-muted italic border-l-2 border-line pl-3">
              {article.excerpt}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <span>작성자: {(article.author as any)?.full_name}</span>
            {(article.category as any)?.name && (
              <span>카테고리: {(article.category as any).name}</span>
            )}
            <span>작성: {new Date(article.created_at).toLocaleDateString('ko-KR')}</span>
            {article.published_at && (
              <span>발행: {new Date(article.published_at).toLocaleDateString('ko-KR')}</span>
            )}
            {article.is_featured && <span className="text-draft">★ 주요 기사</span>}
          </div>

          {article.tags && article.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {article.tags.map((tag: string) => (
                <span key={tag} className="rounded bg-line/60 px-2 py-0.5 text-xs text-muted">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {article.status === 'rejected' && article.reject_reason && (
            <div className="mt-4 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              <strong className="font-medium">반려 사유:</strong> {article.reject_reason}
            </div>
          )}
        </header>

        {/* 대표 이미지 */}
        {article.thumbnail_url && (
          <img
            src={article.thumbnail_url}
            alt={article.title}
            className="mb-6 w-full max-h-80 object-cover rounded border border-line"
          />
        )}

        {/* 본문 */}
        <div className="article-body">
          {article.body}
        </div>
      </article>

      {/* 하단 액션 */}
      <footer className="mt-10 pt-5 border-t border-line flex flex-col gap-4">
        {/* 편집장 검토 패널 */}
        {canReview && (
          <div className="rounded border border-review/30 bg-review/5 px-4 py-3">
            <p className="text-sm text-review font-medium mb-3">
              이 기사는 검토 대기 중입니다. 승인하거나 반려하세요.
            </p>
            <ReviewActions articleId={article.id} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link href="/articles" className="text-sm text-muted hover:text-ink">
            ← 목록으로
          </Link>
          <div className="flex gap-2">
            {canEdit && article.status !== 'published' && (
              <Link href={`/articles/${article.id}/edit`} className="btn-secondary">
                수정
              </Link>
            )}
            {isEditorPlus && article.status === 'published' && (
              <Link href={`/articles/${article.id}/edit`} className="btn-secondary">
                내용 수정
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
