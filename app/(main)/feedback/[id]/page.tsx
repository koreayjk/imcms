import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import { staffName } from '@/lib/support-i18n'
import { FEEDBACK_STATUS, feedbackCategoryLabel, feedbackStatusLabel, type FeedbackStatus } from '@/lib/feedback'
import { FeedbackComment, FeedbackCommentBox, FeedbackPost, FeedbackStatusPicker } from '@/components/cms/Feedback'

type Comment = { id: string; author_id: string; author_name: string | null; is_staff: boolean; body: string; created_at: string; edited_at: string | null }

export default async function FeedbackDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { supabase, user, isStaff, isSuper } = await getCmsContext()
  const { t, lang } = await getT()

  const [{ data: p }, { data: cs }] = await Promise.all([
    supabase.from('feedback_posts').select('*, outlet:outlets(name)').eq('id', id).maybeSingle(),
    supabase.from('feedback_comments').select('id, author_id, author_name, is_staff, body, created_at, edited_at').eq('post_id', id).order('created_at'),
  ])
  if (!p) notFound()
  const comments = (cs ?? []) as Comment[]
  const status = p.status as FeedbackStatus
  const mine = p.author_id === user.id

  return (
    <div className="mx-auto max-w-[860px] px-4 py-5 md:px-8 md:py-8">
      <Link href="/feedback" className="text-[13px] text-muted hover:text-ink">{t('← 개선 요청 목록', '← Improvement requests')}</Link>

      <article className="mt-4 rounded-lg border border-line bg-white px-5 py-5 md:px-8 md:py-7">
        <FeedbackPost id={p.id} canEdit={mine || isSuper} initial={{ category: p.category, title: p.title, body: p.body }}>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className={`rounded px-2 py-1 font-semibold ${FEEDBACK_STATUS[status]?.className ?? ''}`}>{feedbackStatusLabel(status, lang)}</span>
            <span className="text-muted">[{feedbackCategoryLabel(p.category, lang, t('기타', 'Other'))}]</span>
          </div>
          <h1 className="mt-3 break-words text-[22px] font-extrabold leading-snug tracking-tight md:text-[24px]">{p.title}</h1>
          <p className="mt-2 text-[12.5px] text-muted">
            {[mine ? `${p.author_name ?? ''} ${t('(나)', '(you)')}` : p.author_name ?? t('알 수 없음', 'Unknown'), (p.outlet as { name: string } | null)?.name, formatDateTime(p.created_at, lang), p.edited_at ? t('수정됨', 'edited') : null].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-5 whitespace-pre-line break-words border-t border-line pt-5 text-[15px] leading-[1.85]">{p.body}</div>
        </FeedbackPost>
      </article>

      {isStaff ? (
        <section className="mt-4 rounded-lg border border-review/30 bg-review/5 px-5 py-4" aria-label={t('처리 상태 바꾸기', 'Change status')}>
          <p className="mb-2.5 text-[13px] font-semibold text-review">{t('처리 상태', 'Status')} <span className="font-normal text-muted">{t('· 누르면 바로 바뀌고 글쓴이에게 보입니다', '· Changes immediately and is visible to the author')}</span></p>
          <FeedbackStatusPicker id={p.id} status={status} />
          {p.status_at && <p className="mt-2 text-[12px] text-muted">{t('마지막 변경', 'Last changed')} {formatDateTime(p.status_at, lang)}</p>}
        </section>
      ) : status !== 'received' && p.status_at ? (
        <p className="mt-4 rounded-lg border border-line bg-white px-5 py-3 text-[13px] text-muted">
          {lang === 'en'
            ? <>The IM Newsroom team changed the status to <strong className="text-ink">{feedbackStatusLabel(status, lang)}</strong> on {formatDateTime(p.status_at, lang)}.</>
            : <>운영팀이 {formatDateTime(p.status_at)}에 <strong className="text-ink">{FEEDBACK_STATUS[status]?.label}</strong>(으)로 바꿨습니다.</>}
        </p>
      ) : null}

      <section className="mt-6" aria-labelledby="fb-comments">
        <h2 id="fb-comments" className="mb-3 text-[15px] font-bold">{t('댓글', 'Comments')} <span className="tabular-nums text-muted">{comments.length}</span></h2>
        {comments.length > 0 && (
          <ul className="mb-4 space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className={`rounded-lg border px-4 py-3.5 ${c.is_staff ? 'border-review/30 bg-review/5' : 'border-line bg-white'}`}>
                <FeedbackComment id={c.id} body={c.body} canEdit={c.author_id === user.id || isSuper}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                    <strong className="text-ink">{c.is_staff ? staffName(lang) : c.author_name ?? t('알 수 없음', 'Unknown')}</strong>
                    {c.is_staff && c.author_name && <span className="text-muted">{c.author_name}</span>}
                    {c.author_id === user.id && <span className="text-muted">{t('(나)', '(you)')}</span>}
                    <span className="text-muted">{formatDateTime(c.created_at, lang)}{c.edited_at ? t(' · 수정됨', ' · edited') : ''}</span>
                  </p>
                </FeedbackComment>
              </li>
            ))}
          </ul>
        )}
        <FeedbackCommentBox postId={p.id} />
      </section>
    </div>
  )
}
