import { notFound } from 'next/navigation'
import { outletHomeUrl } from '@/lib/product'
import Link from 'next/link'
import ReviewActions from '@/components/ReviewActions'
import CopyLinkButton from '@/components/cms/CopyLinkButton'
import { getCmsContext } from '@/lib/cms'
import { sanitizeBody } from '@/lib/article-html'
import { formatDateTime, isScheduled } from '@/lib/format'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'
import PendingButton from '@/components/cms/PendingButton'
import RevisionHistory, { type Revision } from '@/components/cms/RevisionHistory'
import LegalReview from '@/components/cms/LegalReview'
import type { LegalCheck } from '@/lib/legal-types'
import { deleteArticle } from '../actions'

// 승인하면서 함께 송고할 때 AI로 문장을 바꾸므로 넉넉하게 기다린다
export const maxDuration = 60

export default async function ArticleDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { error?: string } }) {
  const { supabase, user, isEditorPlus, trial } = await getCmsContext()

  const [{ data: article }, { data: revs }] = await Promise.all([
    supabase
      .from('articles')
      .select('*, author:profiles!articles_author_id_fkey(id, full_name), category:categories(name), outlet:outlets(id, domain)')
      .eq('id', params.id)
      .single(),
    // article-revisions.sql 실행 전이면 표가 없어 빈 목록
    supabase
      .from('article_revisions')
      .select('id, changed_at, title, excerpt, body, byline, editor:profiles(full_name)')
      .eq('article_id', params.id)
      .order('changed_at', { ascending: false })
      .limit(50),
  ])
  if (!article) notFound()

  // 체험용 샘플 기사(trial.sql)는 누구도 고치거나 지울 수 없다. 체험 계정은 본인 기사만 지운다
  const sample = !!article.is_sample
  const canEdit = !sample && (article.author_id === user.id || isEditorPlus)
  const canDelete = canEdit && (!trial || article.author_id === user.id)
  // 체험신문 발행 전 검사(trial-moderation.sql)에 걸려 총관리자 확인을 기다리는 기사: 체험 계정은 승인할 수 없다
  const held = !!(article as { moderation_hold?: boolean }).moderation_hold
  const canReview = isEditorPlus && article.status === 'in_review' && !(held && trial)

  return (
    <div className="mx-auto max-w-[860px] px-4 py-5 md:px-8 md:py-8">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/articles" className="hover:text-ink">기사목록</Link>
        <span>›</span>
        <span className="max-w-md truncate text-ink">{article.title}</span>
      </nav>

      {sample && (
        <p className="mb-5 rounded-lg border border-[#1F3A5F]/25 bg-[#1F3A5F]/5 px-5 py-3.5 text-[13.5px] text-[#1F3A5F]">🔒 체험용 샘플 기사입니다. 수정·삭제할 수 없어요. 기사쓰기에서 새 기사를 써서 체험해 보세요.</p>
      )}
      {searchParams.error && (
        <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-5 py-3.5 text-[13.5px] text-danger">{searchParams.error}</p>
      )}

      {held && article.status === 'in_review' && (
        <p role="status" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-5 py-3.5 text-[13.5px] text-danger">
          ⚠ 발행 전 검사에서 욕설·혐오·선정적 표현이 있을 수 있다고 나와 <strong>총관리자 확인</strong>을 기다리고 있습니다.
          {(article as { moderation_note?: string | null }).moderation_note && <span className="mt-1 block text-[12.5px]">사유: {(article as { moderation_note: string }).moderation_note}</span>}
          {!trial && <span className="mt-1 block text-[12.5px]">총관리자가 승인하면 발행되고, 반려하거나 지울 수도 있습니다.</span>}
        </p>
      )}

      {canReview && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg md:gap-4 border border-review/30 bg-review/5 px-5 py-4">
          <p className="text-[14px] font-medium text-review">승인신청된 기사입니다. 내용을 확인하고 승인하거나 반려하세요.</p>
          <ReviewActions articleId={article.id} presetAt={article.published_at} hasSection={!!article.category_id} moderated={!!trial} />
        </div>
      )}

      {'legal_check' in article && !article.legal_check && article.status === 'in_review' && (
        <p className="mb-5 rounded-lg border border-line bg-white px-5 py-3 text-[13px] text-muted">AI 법적 검수를 하지 않고 승인신청한 기사입니다. 필요하면 수정 화면에서 “AI 검수”를 눌러 확인할 수 있습니다.</p>
      )}

      {(article as { legal_check?: LegalCheck | null }).legal_check && (
        <section aria-labelledby="legal-title" className="mb-5 rounded-lg border border-line bg-white px-5 py-4">
          <h2 id="legal-title" className="mb-2 text-[14px] font-bold">AI 법적 검수 <span className="text-[12px] font-normal text-muted">· 승인신청·발행할 때 저장된 결과</span></h2>
          <LegalReview check={(article as { legal_check: LegalCheck }).legal_check} />
        </section>
      )}

      <article className="rounded-lg border border-line bg-white px-5 py-6 md:px-10 md:py-9">
        <header className="border-b border-line pb-6">
          <div className="flex items-center gap-2 text-[12.5px]">
            {isScheduled(article)
              ? <span className="status-badge status-scheduled px-2 py-1">예약 · {formatDateTime(article.published_at)} 공개</span>
              : <span className={`status-badge status-${article.status} px-2 py-1`}>{STATUS_LABEL[article.status as ArticleStatus]}</span>}
            {(article.category as any)?.name && <span className="text-muted">{(article.category as any).name}</span>}
            {article.is_featured && <span className="font-semibold text-draft">★ 주요 기사</span>}
          </div>
          <h1 className="mt-3 text-[28px] font-extrabold leading-snug tracking-tight">{article.title}</h1>
          {article.excerpt && (
            <p className="mt-3 whitespace-pre-line border-l-[3px] border-line pl-4 text-[15.5px] leading-relaxed text-muted">{article.excerpt}</p>
          )}
          <p className="mt-4 text-[12.5px] tabular-nums text-muted">
            {article.byline?.trim() || (article.author as any)?.full_name} 기자
            {(article as { byline_email?: string | null }).byline_email && <span className="ml-1.5">{(article as { byline_email: string }).byline_email}</span>}
            <span className="mx-2 text-line">|</span>작성 {formatDateTime(article.created_at)}
            {article.published_at && <><span className="mx-2 text-line">|</span>발행 {formatDateTime(article.published_at)}</>}
            {(revs?.length ?? 0) > 0 && <><span className="mx-2 text-line">|</span>최종 수정 {formatDateTime(revs![0].changed_at)}</>}
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

      <RevisionHistory
        articleId={article.id}
        revisions={(revs ?? []) as unknown as Revision[]}
        current={{ title: article.title, excerpt: article.excerpt, body: article.body, byline: article.byline ?? null }}
        hasByline={'byline' in article}
        canRestore={canEdit && !article.source_article_id}
        live={article.status === 'published' && !article.source_article_id}
      />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/articles" className="text-[13px] text-muted hover:text-ink">← 목록으로</Link>
        <div className="flex gap-2">
          {article.status === 'published' && (
            <a href={outletHomeUrl((article as { outlet?: { id: string; domain: string | null } | null }).outlet, `/news/${article.id}`)} target="_blank" rel="noopener" className="btn-secondary">홈페이지에서 보기 ↗</a>
          )}
          {canDelete && (
            <form action={deleteArticle.bind(null, article.id)}>
              <PendingButton
                pending="삭제 중…"
                confirm={`이 기사를 삭제할까요?${article.status === 'published' ? '\n홈페이지에서도 바로 내려가고, 함께 송고된 다른 매체 사본도 삭제됩니다.' : ''}\n삭제하면 되돌릴 수 없습니다.`}
                className="btn-secondary text-danger"
              >
                삭제
              </PendingButton>
            </form>
          )}
          <CopyLinkButton articleId={article.id} className="btn-secondary" />
          {canEdit && <Link href={`/articles/${article.id}/edit`} className="btn-primary">수정</Link>}
        </div>
      </div>
    </div>
  )
}
