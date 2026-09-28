import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReviewActions from '@/components/ReviewActions'
import { getCmsContext } from '@/lib/cms'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'

export default async function ArticleDetailPage({ params }: { params: { id: string } }) {
  const { supabase, user, isEditorPlus } = await getCmsContext()

  const { data: article } = await supabase
    .from('articles')
    .select('*, author:profiles!articles_author_id_fkey(id, full_name), category:categories(name)')
    .eq('id', params.id)
    .single()
  if (!article) notFound()

  const canEdit = article.author_id === user.id || isEditorPlus
  const canReview = isEditorPlus && article.status === 'in_review'

  return (
    <div className="mx-auto max-w-[860px] px-8 py-8">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/articles" className="hover:text-ink">기사목록</Link>
        <span>›</span>
        <span className="max-w-md truncate text-ink">{article.title}</span>
      </nav>

      {canReview && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-review/30 bg-review/5 px-5 py-4">
          <p className="text-[14px] font-medium text-review">승인신청된 기사입니다. 내용을 확인하고 승인하거나 반려하세요.</p>
          <ReviewActions articleId={article.id} />
        </div>
      )}

      <article className="rounded-lg border border-line bg-white px-10 py-9">
        <header className="border-b border-line pb-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            <span className={`status-badge status-${article.status} px-2 py-1`}>{STATUS_LABEL[article.status as ArticleStatus]}</span>
            {(article.category as any)?.name && <span className="text-muted">{(article.category as any).name}</span>}
            {article.is_featured && <span className="font-semibold text-draft">★ 주요 기사</span>}
          </div>
          <h1 className="mt-3 text-[28px] font-extrabold leading-snug tracking-tight">{article.title}</h1>
          {article.excerpt && (
            <p className="mt-3 whitespace-pre-line border-l-[3px] border-line pl-4 text-[15.5px] leading-relaxed text-muted">{article.excerpt}</p>
          )}
          <p className="mt-4 text-[12.5px] tabular-nums text-muted">
            {(article.author as any)?.full_name} 기자
            <span className="mx-2 text-line">|</span>작성 {formatDateTime(article.created_at)}
            {article.published_at && <><span className="mx-2 text-line">|</span>발행 {formatDateTime(article.published_at)}</>}
          </p>
          {article.status === 'rejected' && article.reject_reason && (
            <p className="mt-4 rounded border border-danger/30 bg-danger/5 px-4 py-3 text-[13.5px] text-danger">
              <strong>반려 사유:</strong> {article.reject_reason}
            </p>
          )}
        </header>

        <div className="article-content mt-7 text-[16.5px] leading-[1.9]" dangerouslySetInnerHTML={{ __html: sanitizeBody(article.body) }} />

        {article.tags?.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-1.5">
            {article.tags.map((t: string) => <li key={t} className="rounded bg-line/60 px-2 py-0.5 text-[12px] text-muted">#{t}</li>)}
          </ul>
        )}
      </article>

      <div className="mt-6 flex items-center justify-between">
        <Link href="/articles" className="text-[13px] text-muted hover:text-ink">← 목록으로</Link>
        <div className="flex gap-2">
          {article.status === 'published' && (
            <a href={`/news/${article.id}`} target="_blank" rel="noopener" className="btn-secondary">홈페이지에서 보기 ↗</a>
          )}
          {canEdit && <Link href={`/articles/${article.id}/edit`} className="btn-primary">수정</Link>}
        </div>
      </div>
    </div>
  )
}
