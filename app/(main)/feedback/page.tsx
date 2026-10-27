import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import { FEEDBACK_STATUS, feedbackCategoryLabel, feedbackMissing, feedbackStatusLabel, isFeedbackStatus, type FeedbackCategory, type FeedbackStatus } from '@/lib/feedback'
import { NewFeedback } from '@/components/cms/Feedback'

const PAGE_SIZE = 30
const TABS: (FeedbackStatus | 'all')[] = ['all', 'received', 'in_progress', 'exists', 'done', 'declined']

type Row = {
  id: string; title: string; category: FeedbackCategory; status: FeedbackStatus; author_id: string; author_name: string | null
  comment_count: number; created_at: string; updated_at: string; outlet: { name: string } | null
}

export default async function FeedbackPage(props: { searchParams: Promise<{ status?: string; mine?: string; page?: string }> }) {
  const sp = await props.searchParams
  const { supabase, user, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  const status = isFeedbackStatus(sp.status) ? sp.status : undefined
  const mine = sp.mine === '1'
  const page = Math.max(1, Number(sp.page) || 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (q: any) => (mine ? q.eq('author_id', user.id) : q)
  let list = scoped(supabase.from('feedback_posts').select('id, title, category, status, author_id, author_name, comment_count, created_at, updated_at, outlet:outlets(name)', { count: 'exact' }))
  if (status) list = list.eq('status', status)
  const [{ data, count, error }, ...tabCounts] = await Promise.all([
    list.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...TABS.map((t) => {
      const c = scoped(supabase.from('feedback_posts').select('id', { count: 'exact', head: true }))
      return t === 'all' ? c : c.eq('status', t)
    }),
  ])
  const rows = (data ?? []) as Row[]
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams()
    Object.entries({ status, mine: mine ? '1' : undefined, ...p }).forEach(([k, v]) => v && q.set(k, v))
    const s = q.toString()
    return `/feedback${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight">{t('개선 요청', 'Improvement requests')}</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {t('편집국을 쓰면서 불편한 점, 있었으면 하는 기능을 올려 주세요. IM 뉴스룸 운영팀이 보고 처리 상태와 답을 남깁니다.', 'Tell us what is hard to use in the newsroom or what feature you would like to see. The IM Newsroom team will review it and leave a status and a reply.')}
            {!isStaff && t(' 올린 글은 나와 운영팀만 볼 수 있습니다.', ' Only you and the IM Newsroom team can see what you post.')}
          </p>
        </div>
        <NewFeedback />
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[13.5px] text-danger">
          {feedbackMissing(error.message) ? t('개선 요청을 쓰려면 총관리자가 Supabase에서 feedback.sql을 실행해야 합니다.', 'A Super Admin must run feedback.sql in Supabase before improvement requests can be used.') : `${t('불러오지 못했습니다', 'Could not load')}: ${error.message}`}
        </p>
      ) : (
        <section className="rounded-lg border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-2 md:px-5">
            <nav className="-mx-2 flex min-w-0 max-w-full overflow-x-auto px-2 md:mx-0 md:px-0" aria-label={t('처리 상태', 'Status')}>
              {TABS.map((tab, i) => {
                const active = tab === 'all' ? !status : status === tab
                return (
                  <Link key={tab} href={href({ status: tab === 'all' ? undefined : tab, page: undefined })} aria-current={active ? 'page' : undefined}
                    className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-[14px] md:px-3.5 ${active ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                    {tab === 'all' ? t('전체', 'All') : feedbackStatusLabel(tab, lang)}
                    <span className="ml-1.5 text-[12px] tabular-nums opacity-60">{tabCounts[i].count ?? 0}</span>
                  </Link>
                )
              })}
            </nav>
            {isStaff && <div className="flex gap-1 px-2 py-2 text-[13px] md:px-0">
              <Link href={href({ mine: undefined, page: undefined })} className={`rounded px-2.5 py-1 ${!mine ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{t('모두', 'Everyone')}</Link>
              <Link href={href({ mine: '1', page: undefined })} className={`rounded px-2.5 py-1 ${mine ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{t('내 글', 'Mine')}</Link>
            </div>}
          </div>

          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/feedback/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#F8F9FA] md:gap-4 md:px-5">
                    <span className={`w-[72px] shrink-0 rounded px-1.5 py-1 text-center text-[12px] font-semibold ${FEEDBACK_STATUS[r.status]?.className ?? ''}`}>{feedbackStatusLabel(r.status, lang)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5">
                        <span className="shrink-0 text-[12.5px] text-muted">[{feedbackCategoryLabel(r.category, lang, t('기타', 'Other'))}]</span>
                        <span className="truncate text-[14.5px] font-medium">{r.title}</span>
                        {r.comment_count > 0 && <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-review" aria-label={t(`댓글 ${r.comment_count}개`, `${r.comment_count} ${r.comment_count === 1 ? 'comment' : 'comments'}`)}>💬 {r.comment_count}</span>}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted">
                        {[r.author_id === user.id ? t('내 글', 'Mine') : r.author_name ?? t('알 수 없음', 'Unknown'), isStaff ? r.outlet?.name : null, formatDateTime(r.created_at, lang)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-20 text-center text-[14px] text-muted">
              {status ? t(`${FEEDBACK_STATUS[status].label} 상태의 글이 없습니다.`, `No requests with the status "${feedbackStatusLabel(status, lang)}".`) : mine || !isStaff ? t('아직 올린 개선 요청이 없습니다. 불편한 점이나 바라는 기능을 남겨 주세요.', 'You have not posted any requests yet. Tell us what is hard to use or what you would like to see.') : t('아직 올라온 개선 요청이 없습니다.', 'No improvement requests yet.')}
            </p>
          )}
        </section>
      )}

      {pages > 1 && (
        <nav className="mt-4 flex flex-wrap justify-end gap-1 text-[12.5px]" aria-label={t('페이지', 'Pages')}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={href({ page: p > 1 ? String(p) : undefined })} aria-current={p === page ? 'page' : undefined}
              className={`grid h-8 min-w-8 place-items-center rounded border px-2 tabular-nums ${p === page ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
