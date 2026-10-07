import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { STAFF_NAME } from '@/lib/support'
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUS, type FeedbackCategory, type FeedbackStatus } from '@/lib/feedback'
import { FeedbackComment, FeedbackCommentBox, FeedbackPost, FeedbackStatusPicker } from '@/components/cms/Feedback'

type Comment = { id: string; author_id: string; author_name: string | null; is_staff: boolean; body: string; created_at: string; edited_at: string | null }

export default async function FeedbackDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { supabase, user, isStaff, isSuper } = await getCmsContext()

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
      <Link href="/feedback" className="text-[13px] text-muted hover:text-ink">← 개선 요청 목록</Link>

      <article className="mt-4 rounded-lg border border-line bg-white px-5 py-5 md:px-8 md:py-7">
        <FeedbackPost id={p.id} canEdit={mine || isSuper} initial={{ category: p.category, title: p.title, body: p.body }}>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className={`rounded px-2 py-1 font-semibold ${FEEDBACK_STATUS[status]?.className ?? ''}`}>{FEEDBACK_STATUS[status]?.label ?? status}</span>
            <span className="text-muted">[{FEEDBACK_CATEGORIES[p.category as FeedbackCategory] ?? '기타'}]</span>
          </div>
          <h1 className="mt-3 break-words text-[22px] font-extrabold leading-snug tracking-tight md:text-[24px]">{p.title}</h1>
          <p className="mt-2 text-[12.5px] text-muted">
            {[mine ? `${p.author_name ?? ''} (나)` : p.author_name ?? '알 수 없음', (p.outlet as { name: string } | null)?.name, formatDateTime(p.created_at), p.edited_at ? '수정됨' : null].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-5 whitespace-pre-line break-words border-t border-line pt-5 text-[15px] leading-[1.85]">{p.body}</div>
        </FeedbackPost>
      </article>

      {isStaff ? (
        <section className="mt-4 rounded-lg border border-review/30 bg-review/5 px-5 py-4" aria-label="처리 상태 바꾸기">
          <p className="mb-2.5 text-[13px] font-semibold text-review">처리 상태 <span className="font-normal text-muted">· 누르면 바로 바뀌고 글쓴이에게 보입니다</span></p>
          <FeedbackStatusPicker id={p.id} status={status} />
          {p.status_at && <p className="mt-2 text-[12px] text-muted">마지막 변경 {formatDateTime(p.status_at)}</p>}
        </section>
      ) : status !== 'received' && p.status_at ? (
        <p className="mt-4 rounded-lg border border-line bg-white px-5 py-3 text-[13px] text-muted">
          운영팀이 {formatDateTime(p.status_at)}에 <strong className="text-ink">{FEEDBACK_STATUS[status]?.label}</strong>(으)로 바꿨습니다.
        </p>
      ) : null}

      <section className="mt-6" aria-labelledby="fb-comments">
        <h2 id="fb-comments" className="mb-3 text-[15px] font-bold">댓글 <span className="tabular-nums text-muted">{comments.length}</span></h2>
        {comments.length > 0 && (
          <ul className="mb-4 space-y-2.5">
            {comments.map((c) => (
              <li key={c.id} className={`rounded-lg border px-4 py-3.5 ${c.is_staff ? 'border-review/30 bg-review/5' : 'border-line bg-white'}`}>
                <FeedbackComment id={c.id} body={c.body} canEdit={c.author_id === user.id || isSuper}>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                    <strong className="text-ink">{c.is_staff ? STAFF_NAME : c.author_name ?? '알 수 없음'}</strong>
                    {c.is_staff && c.author_name && <span className="text-muted">{c.author_name}</span>}
                    {c.author_id === user.id && <span className="text-muted">(나)</span>}
                    <span className="text-muted">{formatDateTime(c.created_at)}{c.edited_at ? ' · 수정됨' : ''}</span>
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
