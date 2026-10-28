import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDate } from '@/lib/format'
import { parsePeriod, periodBounds, type StatsPeriod } from '@/lib/stats-period'
import { fetchFeed } from './actions'
import LiveComments from './LiveComments'

type Summary = { v_today: number; v_week: number; v_month: number; v_year: number; v_total: number; s_total: number; c_approved: number; c_pending: number }
type Row = {
  id: string; title: string; outlet_name: string; category_name: string | null; published_at: string | null
  views: number; views_total: number; comments: number; comments_pending: number; shares: number; shares_total: number
}
type SortKey = 'views' | 'comments' | 'shares'

// 편집국 통계: 기사 조회수·공유·댓글을 기간별로 보고, 새 댓글을 바로 관리한다 (편집장 이상)
export default async function StatsPage(props: { searchParams: Promise<{ p?: string; s?: string }> }) {
  const sp = await props.searchParams
  const { supabase, outletId, isEditorPlus, isStaff, lang } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/articles')
  const { t } = await getT()
  const en = lang === 'en'
  const period = parsePeriod(sp.p)
  const sort: SortKey = sp.s === 'comments' || sp.s === 'shares' ? sp.s : 'views'
  const nf = new Intl.NumberFormat(en ? 'en-US' : 'ko-KR')

  // 하루의 기준은 그 매체의 시간대
  let tz = 'Asia/Seoul'
  if (outletId) {
    const { data: o } = await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle()
    tz = ((o?.site as { timeZone?: string } | null)?.timeZone) || tz
  }
  const b = periodBounds(tz)
  const from = period === 'all' ? null : period === 'today' ? b.today : period === 'week' ? b.week : period === 'month' ? b.month : b.year

  const [sum, daily, list, feed] = await Promise.all([
    supabase.rpc('outlet_view_summary', { p_outlet: outletId, p_today: b.today, p_week: b.week, p_month: b.month, p_year: b.year }),
    supabase.rpc('outlet_daily_views', { p_outlet: outletId, p_from: b.ago30 }),
    supabase.rpc('article_stats_list', { p_outlet: outletId, p_from: from, p_sort: sort, p_limit: 30 }),
    fetchFeed('new'),
  ])
  const notReady = !!(sum.error || list.error)
  const s = ((sum.data as Summary[] | null)?.[0]) ?? null
  const rows = (list.data ?? []) as Row[]
  const byDay = new Map(((daily.data ?? []) as { day: string; views: number }[]).map((d) => [d.day, Number(d.views)]))
  const bars = b.days30.map((d) => ({ d, v: byDay.get(d) ?? 0 }))
  const maxBar = Math.max(1, ...bars.map((x) => x.v))

  const PERIOD_LABEL: Record<StatsPeriod, string> = {
    today: t('오늘', 'Today'), week: t('이번 주', 'This week'), month: t('이번 달', 'This month'), year: t('올해', 'This year'), all: t('전체', 'All time'),
  }
  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'views', label: t('조회 많은 순', 'Most viewed') }, { key: 'comments', label: t('댓글 많은 순', 'Most comments') }, { key: 'shares', label: t('공유 많은 순', 'Most shared') },
  ]
  const href = (p: StatsPeriod, k: SortKey) => `/admin/stats?p=${p}&s=${k}`
  const cards: { label: string; value: number; sub?: string }[] = s ? [
    { label: t('오늘', 'Today'), value: Number(s.v_today) },
    { label: t('이번 주', 'This week'), value: Number(s.v_week) },
    { label: t('이번 달', 'This month'), value: Number(s.v_month) },
    { label: t('올해', 'This year'), value: Number(s.v_year) },
    { label: t('전체 조회수', 'All-time views'), value: Number(s.v_total), sub: t('켜기 전 조회수 모두 포함', 'includes views from before this feature') },
  ] : []

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('통계', 'Insights')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {t('기사 조회수·공유·댓글을 기간별로 보고, 새 댓글에 바로 답글을 달거나 차단합니다. 하루별 조회수는 통계 기능을 켠 날부터 쌓입니다. 켜기 전 조회수는 날짜를 알 수 없어서, 그 기간 안에 발행된 기사만 그 기간 숫자에 넣습니다. “전체”는 모든 조회수를 포함합니다.', 'See story views, shares and comments by period, and reply to or block new comments right away. Daily views are recorded from the day this feature was turned on. Earlier views have no date, so they are counted in a period only for stories published within it. “All time” includes every view.')}
        </p>
      </header>

      {notReady && (
        <p className="mb-5 rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('통계를 보려면 운영팀이 Supabase에서 article-stats.sql을 먼저 실행해야 합니다.', 'The operations team needs to run article-stats.sql in Supabase before statistics can be shown.')}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          {s && (
            <>
              <section aria-label={t('조회수 요약', 'Views summary')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {cards.map((c) => (
                  <div key={c.label} className="rounded-lg border border-line bg-white px-4 py-3">
                    <p className="text-[12px] text-muted">{c.label}</p>
                    <p className="mt-1 text-[24px] font-bold tabular-nums leading-none">{nf.format(c.value)}</p>
                    {c.sub && <p className="mt-1 text-[11px] text-muted">{c.sub}</p>}
                  </div>
                ))}
              </section>
              <section aria-label={t('공유·댓글 요약', 'Shares and comments summary')} className="grid grid-cols-3 gap-3 text-[13px]">
                <div className="rounded-lg border border-line bg-white px-4 py-3"><p className="text-[12px] text-muted">{t('퍼 나른 횟수(공유)', 'Shares')}</p><p className="mt-0.5 text-[18px] font-bold tabular-nums">{nf.format(Number(s.s_total))}</p></div>
                <div className="rounded-lg border border-line bg-white px-4 py-3"><p className="text-[12px] text-muted">{t('공개된 댓글', 'Published comments')}</p><p className="mt-0.5 text-[18px] font-bold tabular-nums">{nf.format(Number(s.c_approved))}</p></div>
                <div className="rounded-lg border border-line bg-white px-4 py-3"><p className="text-[12px] text-muted">{t('승인 대기 댓글', 'Comments pending')}</p><p className={`mt-0.5 text-[18px] font-bold tabular-nums ${Number(s.c_pending) > 0 ? 'text-danger' : ''}`}>{nf.format(Number(s.c_pending))}</p></div>
              </section>

              <section aria-label={t('최근 30일 조회수', 'Views, last 30 days')} className="rounded-lg border border-line bg-white p-4">
                <h2 className="text-[14px] font-bold">{t('최근 30일 조회수', 'Views — last 30 days')}</h2>
                <svg viewBox="0 0 600 150" className="mt-3 h-[150px] w-full" role="img" aria-label={t('하루별 조회수 막대그래프', 'Daily views bar chart')}>
                  {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2="600" y1={130 - g * 110} y2={130 - g * 110} stroke="#E6E9EE" strokeWidth="1" />)}
                  {bars.map((x, i) => {
                    const h = (x.v / maxBar) * 110
                    return (
                      <g key={x.d}>
                        <rect x={i * 20 + 3} y={130 - h} width="14" height={Math.max(h, x.v ? 1 : 0)} rx="2" fill={x.d === b.today ? '#C9372C' : '#1D3461'}><title>{`${x.d} · ${nf.format(x.v)}`}</title></rect>
                        {i % 5 === 0 && <text x={i * 20 + 10} y="146" textAnchor="middle" fontSize="10" fill="#7A818C">{x.d.slice(5).replace('-', '.')}</text>}
                      </g>
                    )
                  })}
                  <text x="0" y="14" fontSize="10" fill="#7A818C">{nf.format(maxBar)}</text>
                </svg>
              </section>
            </>
          )}

          <section aria-label={t('기사별 통계', 'Story statistics')} className="rounded-lg border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <nav className="flex flex-wrap gap-1" aria-label={t('기간', 'Period')}>
                {(Object.keys(PERIOD_LABEL) as StatsPeriod[]).map((k) => (
                  <Link key={k} href={href(k, sort)} aria-current={period === k ? 'page' : undefined} className={`rounded px-3 py-1.5 text-[13px] ${period === k ? 'bg-ink font-semibold text-white' : 'text-muted hover:bg-paper hover:text-ink'}`}>{PERIOD_LABEL[k]}</Link>
                ))}
              </nav>
              <nav className="flex flex-wrap gap-1" aria-label={t('정렬', 'Sort')}>
                {SORTS.map((x) => (
                  <Link key={x.key} href={href(period, x.key)} aria-current={sort === x.key ? 'true' : undefined} className={`rounded-full border px-3 py-1 text-[12.5px] ${sort === x.key ? 'border-ink font-semibold' : 'border-line text-muted hover:text-ink'}`}>{x.label}</Link>
                ))}
              </nav>
            </div>
            {rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13.5px] text-muted">{t('아직 집계된 기사가 없습니다.', 'No stories to show yet.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[12px] text-muted">
                      <th className="w-8 px-4 py-2 font-medium">#</th>
                      <th className="py-2 font-medium">{t('기사', 'Story')}</th>
                      <th className="px-3 py-2 text-right font-medium">{period === 'all' ? t('조회', 'Views') : t(`조회 (${PERIOD_LABEL[period]})`, `Views (${PERIOD_LABEL[period]})`)}</th>
                      {period !== 'all' && <th className="px-3 py-2 text-right font-medium">{t('전체 조회', 'All-time')}</th>}
                      <th className="px-3 py-2 text-right font-medium">{t('댓글', 'Comments')}</th>
                      <th className="px-4 py-2 text-right font-medium">{t('공유', 'Shares')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id} className="border-b border-line last:border-0 align-top">
                        <td className="px-4 py-2.5 tabular-nums text-muted">{i + 1}</td>
                        <td className="max-w-[420px] py-2.5">
                          <Link href={`/articles/${r.id}`} className="font-semibold leading-snug hover:underline">{r.title}</Link>
                          <p className="mt-0.5 text-[11.5px] text-muted">{[!outletId ? r.outlet_name : null, r.category_name, formatDate(r.published_at, lang)].filter(Boolean).join(' · ')}</p>
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${sort === 'views' ? 'font-bold' : ''}`}>{nf.format(Number(r.views))}</td>
                        {period !== 'all' && <td className="px-3 py-2.5 text-right tabular-nums text-muted">{nf.format(Number(r.views_total))}</td>}
                        <td className={`px-3 py-2.5 text-right tabular-nums ${sort === 'comments' ? 'font-bold' : ''}`}>
                          {nf.format(Number(r.comments))}{Number(r.comments_pending) > 0 && <span className="ml-1 rounded bg-danger/10 px-1 text-[11px] text-danger">{t(`대기 ${r.comments_pending}`, `${r.comments_pending} pending`)}</span>}
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${sort === 'shares' ? 'font-bold' : ''}`}>{nf.format(Number(r.shares))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-line px-4 py-2 text-[11.5px] text-muted">{t('댓글은 공개된 것과 승인 대기를 합친 개수입니다(반려·삭제 제외). 공유는 독자가 기사 아래 공유 버튼(페이스북·X·카카오톡·링크 복사)을 누른 횟수이며, 같은 브라우저는 10분에 한 번만 셉니다.', 'Comments = published + pending (rejected and deleted are excluded). Shares count taps on the share buttons under a story (Facebook, X, KakaoTalk, copy link), once per browser every 10 minutes.')}</p>
          </section>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <LiveComments initial={feed.rows} initialPending={feed.pending} initialError={feed.error} />
        </aside>
      </div>
    </div>
  )
}
