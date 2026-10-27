import { toHtml } from '@/lib/body-text'
import { formatDateTime } from '@/lib/format'
import { compactDiff, diffParagraphs, htmlParagraphs, type DiffRow } from '@/lib/text-diff'
import RevisionRestore from './RevisionRestore'
import { getT } from '@/lib/cms-t'
import type { T } from '@/lib/cms-i18n'

export type Revision = {
  id: number
  changed_at: string
  title: string | null
  excerpt: string | null
  body: string | null
  byline: string | null
  editor: { full_name: string | null } | null
}
type Content = { title: string | null; excerpt: string | null; body: string | null; byline?: string | null }

const paras = (body: string | null) => htmlParagraphs(toHtml(body))

function Rows({ rows, t }: { rows: DiffRow[]; t: T }) {
  return (
    <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
      {rows.map((r, i) =>
        r.kind === 'skip' ? (
          <li key={i} className="text-[12px] text-muted">{t(`… 같은 문단 ${r.count}개`, `… ${r.count} unchanged ${r.count === 1 ? 'paragraph' : 'paragraphs'}`)}</li>
        ) : (
          <li
            key={i}
            className={
              r.kind === 'del' ? 'rounded bg-danger/[0.07] px-2.5 py-1 text-danger line-through decoration-danger/40'
                : r.kind === 'add' ? 'rounded bg-[#15803D]/[0.08] px-2.5 py-1 text-[#166534]'
                  : 'px-2.5 text-muted'
            }
          >
            <span className="sr-only">{r.kind === 'del' ? t('지운 문단: ', 'Deleted paragraph: ') : r.kind === 'add' ? t('새 문단: ', 'New paragraph: ') : ''}</span>
            {r.kind === 'del' ? '− ' : r.kind === 'add' ? '+ ' : ''}{r.text}
          </li>
        )
      )}
    </ol>
  )
}

function Field({ label, before, after, t }: { label: string; before: string | null | undefined; after: string | null | undefined; t: T }) {
  const b = (before ?? '').trim(), a = (after ?? '').trim()
  if (b === a) return null
  return (
    <div>
      <p className="mb-1 text-[12px] font-semibold text-muted">{label}</p>
      <Rows rows={[...(b ? [{ kind: 'del' as const, text: b }] : []), ...(a ? [{ kind: 'add' as const, text: a }] : [])]} t={t} />
    </div>
  )
}

// 기사 수정 이력: 누가 언제 고쳤는지, 무엇이 바뀌었는지 (고치기 전 → 고친 뒤)
export default async function RevisionHistory({ articleId, revisions, current, hasByline, canRestore, live }: {
  articleId: string
  revisions: Revision[]
  current: Content
  hasByline: boolean
  canRestore: boolean
  live: boolean
}) {
  if (!revisions.length) return null
  const { t, lang } = await getT()
  return (
    <section aria-labelledby="revisions-title" className="mt-8 rounded-lg border border-line bg-white">
      <div className="border-b border-line px-5 py-4">
        <h2 id="revisions-title" className="text-[15px] font-bold">{t('수정 이력', 'Edit history')} <span className="font-medium text-muted tabular-nums">{revisions.length}</span></h2>
        <p className="mt-1 text-[12.5px] text-muted">{t('발행·승인신청 뒤에 제목·부제·본문·기자명을 고친 기록입니다. 열어 보면 바뀐 부분이 보입니다.', 'A record of changes to the headline, subhead, body and byline made after the story was published or submitted for review. Open an entry to see what changed.')}</p>
      </div>
      <ul className="divide-y divide-line">
        {revisions.map((rev, k) => {
          // 이 수정으로 바뀐 내용 = 이 판(고치기 전) → 바로 다음 판 (가장 최근 수정이면 지금 기사)
          const after: Content = k === 0 ? current : revisions[k - 1]
          const when = formatDateTime(rev.changed_at, lang)
          const body = compactDiff(diffParagraphs(paras(rev.body), paras(after.body)))
          const bodyChanged = body.some((r) => r.kind === 'del' || r.kind === 'add')
          return (
            <li key={rev.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-3.5 hover:bg-line/30">
                  <span className="mt-[3px] text-[11px] text-muted transition-transform group-open:rotate-90" aria-hidden>▶</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] tabular-nums">
                      <strong className="font-semibold">{when}</strong>
                      <span className="text-muted"> · {lang === 'en' ? `Edited by ${rev.editor?.full_name ?? 'unknown'}` : `${rev.editor?.full_name ?? '알 수 없음'} 수정`}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted">{t('고치기 전 제목', 'Headline before edit')}: {rev.title || t('(없음)', '(none)')}</span>
                  </span>
                </summary>
                <div className="space-y-4 px-5 pb-5 pl-11">
                  <Field label={t('제목', 'Headline')} before={rev.title} after={after.title} t={t} />
                  <Field label={t('부제', 'Subhead')} before={rev.excerpt} after={after.excerpt} t={t} />
                  {hasByline && <Field label={t('기자명', 'Byline')} before={rev.byline} after={after.byline} t={t} />}
                  {bodyChanged && (
                    <div>
                      <p className="mb-1 text-[12px] font-semibold text-muted">{t('본문', 'Body')}</p>
                      <Rows rows={body} t={t} />
                    </div>
                  )}
                  {canRestore && (
                    <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                      <RevisionRestore
                        articleId={articleId}
                        snapshot={{ title: rev.title, excerpt: rev.excerpt, body: rev.body, ...(hasByline ? { byline: rev.byline } : {}) }}
                        when={when}
                        live={live}
                      />
                      <span className="text-[12px] text-muted">{t('기사 내용을 이 수정 전으로 되돌립니다.', 'Restores the story to how it was before this edit.')}</span>
                    </div>
                  )}
                </div>
              </details>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
