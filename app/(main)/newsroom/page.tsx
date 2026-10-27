import Link from 'next/link'
import { outletHomeUrl } from '@/lib/product'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { ticketScope } from '@/lib/view-scope'
import { formatDateTime, isScheduled } from '@/lib/format'
import { statusLabel, type ArticleStatus } from '@/lib/types'
import { getT } from '@/lib/cms-t'
import { EXTRA_AI_FEE } from '@/lib/pricing'
import { aiLevel, aiLimitMessage, getAiStatus } from '@/lib/ai-usage'
import { NOTICE_CATEGORIES, TICKET_STATUS, hasUnreadReply, noticeCategoryLabel, ticketStatusLabel, won, type NoticeCategory, type TicketStatus } from '@/lib/support'

// 기사 현황 칸 (팔레트 '현대적인' 회청 + '고급스러운' 금·주황 + 로고 남색)
//   승인신청(편집장이 먼저 볼 것)이 가장 눈에 띄고, 작성중은 조용하게
const CARDS: { status: ArticleStatus; tone: string; sub: string; ring: string; note: [ko: string, en: string] }[] = [
  { status: 'draft', tone: 'bg-[#AEB3C9] text-[#1F2340]', sub: 'text-[#1F2340]/70', ring: 'ring-[#6E728C]', note: ['저장만 하고 아직 제출하지 않은 기사', 'Saved stories not yet submitted'] },
  { status: 'in_review', tone: 'bg-[#E8A93A] text-[#2A1C00]', sub: 'text-[#2A1C00]/70', ring: 'ring-[#B9831F]', note: ['편집장 승인을 기다리는 기사', 'Stories awaiting Editor-in-Chief approval'] },
  { status: 'rejected', tone: 'bg-[#C47A2C] text-white', sub: 'text-white/80', ring: 'ring-[#9A5D1E]', note: ['수정이 필요한 기사', 'Stories that need revisions'] },
  { status: 'published', tone: 'bg-[#1D3461] text-white', sub: 'text-white/75', ring: 'ring-[#1D3461]', note: ['홈페이지에 공개된 기사', 'Stories live on the homepage'] },
]

// lib/ai-usage.ts 의 aiLimitMessage 영어판 (그 파일은 이 담당 밖이라 여기에 둔다)
function aiLimitMessageEn(s: { used: number; limit: number | null; overage: boolean; over?: number }) {
  if (s.limit == null) return ''
  if (s.used >= s.limit) {
    return s.overage
      ? `You have exceeded this month’s AI usage limit (${s.limit.toLocaleString('en-US')} uses) and are now using extra capacity${s.over ? ` (${s.over.toLocaleString('en-US')} uses)` : ''}. Extra usage is billed at KRW ${EXTRA_AI_FEE.toLocaleString('en-US')} per 100 uses.`
      : `You have used up this month’s AI usage limit (${s.limit.toLocaleString('en-US')} uses). It resets on the 1st of next month; to use more, request “extra usage” from the Support Center. Creating a story from the original text remains available.`
  }
  const left = s.limit - s.used
  return `AI used this month: ${s.used.toLocaleString('en-US')}/${s.limit.toLocaleString('en-US')} (drafts and legal checks) · ${left.toLocaleString('en-US')} left`
}

type Props = { searchParams: Promise<{ tab?: string }> }

export default async function NewsroomPage(props: Props) {
  const searchParams = await props.searchParams
  const { t, lang } = await getT()
  const num = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : 'ko-KR')
  const aiMessage = (s: Parameters<typeof aiLimitMessage>[0]) => (lang === 'en' ? aiLimitMessageEn(s) : aiLimitMessage(s))
  const ctx = await getCmsContext()
  const { supabase, user, outletId, isEditorPlus, isStaff, isSuper, trial } = ctx
  // 매체에 속하지 않은 매니저는 대시보드가 첫 화면
  if (isStaff && !isSuper && !outletId) redirect('/admin/dashboard')
  const tab = (CARDS.find((c) => c.status === searchParams.tab)?.status ?? 'draft') as ArticleStatus

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (q: any) => {
    let out = q
    if (!isEditorPlus) out = out.eq('author_id', user.id)
    if (outletId) out = out.eq('outlet_id', outletId)
    return out
  }

  const countOf = (status: ArticleStatus) =>
    scoped(supabase.from('articles').select('id', { count: 'exact', head: true })).eq('status', status)

  // 광고 계약 알림 (편집장·발행인): 7일 안에 끝나는 광고, 시작했는데 입금 안 된 광고 (ad-contracts.sql 전이면 조용히 없음)
  const kstToday = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  // 체험 기자 화면: 내 기사만 세므로, 체험신문 전체에 이미 발행된 기사 수를 함께 알려 준다
  const trialReporter = !!trial && !isEditorPlus && !!outletId
  // 화면에 필요한 조회는 모두 한꺼번에 보낸다 (하나씩 기다리면 메뉴를 열 때마다 그만큼 느려진다)
  const [counts, list, reviewQueue, popular, { data: notices }, { data: myTickets }, aiUsage, adRes, trialCount, trialOutlet] = await Promise.all([
    Promise.all(CARDS.map((c) => countOf(c.status))),
    scoped(
      supabase
        .from('articles')
        .select('id, title, status, updated_at, published_at, view_count, reject_reason, byline, author:profiles!articles_author_id_fkey(full_name), category:categories(name)')
    ).eq('status', tab).order(tab === 'published' ? 'published_at' : 'updated_at', { ascending: false }).limit(12),
    isEditorPlus
      ? scoped(supabase.from('articles').select('id, title, updated_at, author:profiles!articles_author_id_fkey(full_name)'))
          .eq('status', 'in_review').order('updated_at', { ascending: true }).limit(6)
      : Promise.resolve({ data: [] as any[] }),
    // 많이 본 기사는 역할과 상관없이 우리 신문 전체에서 고른다 (기자도 신문 전체 반응을 본다)
    (outletId ? supabase.from('articles').select('id, title, view_count').eq('outlet_id', outletId) : supabase.from('articles').select('id, title, view_count'))
      .eq('status', 'published').lte('published_at', new Date().toISOString()).order('view_count', { ascending: false }).limit(5),
    // 고객센터 소식 (support.sql 전이면 비어 있다)
    supabase.from('support_notices').select('id, title, category, created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
    ticketScope(supabase.from('support_tickets').select('id, title, status, last_staff_reply_at, requester_read_at').eq('requester_id', user.id), ctx, user.id).order('updated_at', { ascending: false }).limit(3),
    getAiStatus(supabase, outletId),
    isEditorPlus && outletId && !trial
      ? supabase.from('ad_contracts').select('advertiser, starts_on, ends_on, supply_amount, vat_amount, paid_amount').eq('outlet_id', outletId).lte('starts_on', kstToday).limit(500)
      : Promise.resolve({ data: null }),
    trialReporter
      ? supabase.from('articles').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId!).eq('status', 'published')
      : Promise.resolve({ count: null }),
    trialReporter ? supabase.from('outlets').select('id, domain').eq('id', outletId!).maybeSingle() : Promise.resolve({ data: null }),
  ])
  // 이번 달 AI 사용 한도(초안·법적 검수)의 80%를 넘으면 알린다
  const aiLvl = aiLevel(aiUsage)
  const aiAlert = aiUsage && (aiLvl === 'near' || aiLvl === 'full' || aiLvl === 'over') ? aiLvl : null

  const adRows = (adRes.data ?? []) as { advertiser: string; starts_on: string; ends_on: string; supply_amount: number; vat_amount: number; paid_amount: number }[]
  const weekLater = new Date(Date.parse(kstToday) + 7 * 864e5).toISOString().slice(0, 10)
  const adEnding = adRows.filter((c) => c.ends_on >= kstToday && c.ends_on <= weekLater)
  const adDue = adRows.filter((c) => Number(c.supply_amount) + Number(c.vat_amount) > Number(c.paid_amount))
  const adDueSum = adDue.reduce((n, c) => n + Number(c.supply_amount) + Number(c.vat_amount) - Number(c.paid_amount), 0)

  const rows = (list.data ?? []) as any[]
  const trialPublished = trialReporter ? trialCount.count ?? 0 : null
  const trialSite = trialReporter ? outletHomeUrl(trialOutlet.data) : '/'

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-5 flex items-end justify-between gap-3 md:mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{t('뉴스룸', 'Newsroom')}</h1>
          <p className="mt-1 text-[13px] text-muted">{isEditorPlus ? t('편집국 전체 기사 현황', 'Story status across the newsroom') : t('내 기사 현황', 'My story status')}</p>
        </div>
        <Link href="/articles/new" className="btn-primary shrink-0 px-4 py-2.5 md:px-5">{t('+ 기사쓰기', '+ Write')}</Link>
      </div>

      {trialPublished !== null && (
        <p className="mb-4 rounded-lg border border-[#1F4FD0]/20 bg-[#EEF3FD] px-5 py-3 text-[13.5px] leading-relaxed text-[#14306E]">
          {lang === 'en' ? <>
            The Reporter view counts only <b>stories you wrote</b>. IM Trial News currently has <b>{trialPublished.toLocaleString('en-US')} published {trialPublished === 1 ? 'story' : 'stories'}</b>.
            Switch to <b>Editor-in-Chief</b> at the top to see the whole newsroom, or open the <a href={trialSite} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">homepage</a> to see the reader’s view.
          </> : <>
          기자 화면에는 <b>내가 쓴 기사</b>만 셉니다. IM 체험뉴스에는 지금 <b>발행 기사 {trialPublished.toLocaleString()}건</b>이 있어요.
          맨 위에서 <b>편집장</b>으로 바꾸면 편집국 전체 현황을, <a href={trialSite} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">홈페이지</a>에서 독자 화면을 볼 수 있어요.
          </>}
        </p>
      )}

      {aiAlert && aiUsage && (
        <div role="status" className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-5 py-3 text-[13.5px] ${aiAlert === 'near' ? 'border-draft/40 bg-draft/10' : 'border-danger/30 bg-danger/5 text-danger'}`}>
          <span className="min-w-[12rem] flex-1">{aiAlert === 'near' ? `${t('AI 사용 한도에 가까워졌습니다.', 'You are close to your AI usage limit.')} ${aiMessage(aiUsage)}` : aiMessage(aiUsage)}</span>
          {isEditorPlus && !aiUsage.overage && <Link href="/support/tickets/new" className="shrink-0 font-semibold underline underline-offset-2">{t('추가 사용·요금제 변경 요청 →', 'Request extra usage or a plan change →')}</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {CARDS.map((c, i) => (
          <Link
            key={c.status}
            href={`/newsroom?tab=${c.status}`}
            aria-current={tab === c.status ? 'true' : undefined}
            className={`rounded-xl px-4 py-4 shadow-[0_6px_16px_-8px_rgba(16,24,40,0.35)] transition md:px-6 md:py-5 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-10px_rgba(16,24,40,0.5)] ${c.tone} ${tab === c.status ? `ring-2 ring-offset-2 ring-offset-[#F4F5F7] ${c.ring}` : ''}`}
          >
            <div className={`text-[13.5px] font-semibold ${c.sub}`}>{statusLabel(c.status, lang)}</div>
            <div className="mt-2 text-[32px] font-extrabold leading-none tracking-tight tabular-nums md:text-[40px]">{counts[i].count ?? 0}</div>
            <div className={`mt-1.5 hidden text-[12px] sm:block ${c.sub}`}>{t(...c.note)}</div>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:mt-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-line px-2 md:px-5">
            {/* 휴대폰: 탭이 넘치면 옆으로 밀어서 본다 (오른쪽 끝을 흐리게 해 잘린 듯 보이지 않게) */}
            <div className="flex min-w-0 overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] md:[mask-image:none]">
              {CARDS.map((c, i) => (
                <Link
                  key={c.status}
                  href={`/newsroom?tab=${c.status}`}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2 py-3.5 text-[14px] md:px-4 ${
                    tab === c.status ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {statusLabel(c.status, lang)}
                  <span className="ml-1.5 rounded-full bg-line/80 px-1.5 text-[11px] tabular-nums text-muted">{counts[i].count ?? 0}</span>
                </Link>
              ))}
            </div>
            <Link href={`/articles?status=${tab}`} className="shrink-0 whitespace-nowrap pl-1 pr-2 text-[12.5px] text-muted hover:text-ink md:pr-0">{t('더보기 +', 'More +')}</Link>
          </div>

          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link href={a.status === 'published' ? `/articles/${a.id}` : `/articles/${a.id}/edit`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[#F8F9FA] md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[14.5px] font-medium md:truncate">
                        {isScheduled(a) && <span className="status-badge status-scheduled mr-1.5 align-[1px]">{t('예약', 'Scheduled')}</span>}
                        {a.title}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted md:hidden">
                        {[a.category?.name ?? t('섹션 없음', 'No section'), isEditorPlus ? (a.byline?.trim() || a.author?.full_name) : null, a.status === 'published' ? t(`조회 ${a.view_count ?? 0}`, `${num(a.view_count ?? 0)} views`) : null, formatDateTime(a.status === 'published' ? a.published_at : a.updated_at, lang)].filter(Boolean).join(' · ')}
                      </p>
                      {a.status === 'rejected' && a.reject_reason && (
                        <p className="mt-0.5 truncate text-[12px] text-danger">{t('반려 사유', 'Reason for rejection')}: {a.reject_reason}</p>
                      )}
                    </div>
                    <span className="hidden w-24 shrink-0 truncate text-[12px] text-muted md:block">{a.category?.name ?? t('섹션 없음', 'No section')}</span>
                    {isEditorPlus && <span className="hidden w-16 shrink-0 truncate text-[12px] text-muted md:block">{a.byline?.trim() || a.author?.full_name}</span>}
                    {a.status === 'published' && (
                      <span className="hidden w-14 shrink-0 text-right text-[12px] tabular-nums text-muted md:block">{t(`조회 ${a.view_count ?? 0}`, `${num(a.view_count ?? 0)} views`)}</span>
                    )}
                    <time className="hidden w-[118px] shrink-0 text-right text-[12px] tabular-nums text-muted md:block">
                      {formatDateTime(a.status === 'published' ? a.published_at : a.updated_at, lang)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-16 text-center text-[14px] text-muted">{t(`${statusLabel(tab)} 상태의 기사가 없습니다.`, `No stories with status “${statusLabel(tab, 'en')}”.`)}</p>
          )}
        </section>

        <aside className="space-y-6">
          {(adEnding.length > 0 || adDue.length > 0) && (
            <Link href="/admin/ads/contracts" className="block rounded-lg border border-draft/50 bg-draft/5 px-5 py-3.5 text-[13px] leading-relaxed hover:border-draft">
              <p className="font-bold">{t('광고 확인할 일', 'Ad items to check')}</p>
              {adEnding.length > 0 && <p>{lang === 'en' ? <>· <strong>{adEnding.length} {adEnding.length === 1 ? 'ad' : 'ads'}</strong> ending within 7 days ({adEnding.slice(0, 2).map((c) => c.advertiser).join(', ')}{adEnding.length > 2 ? ', etc.' : ''}) — contact about renewal</> : <>· 7일 안에 끝나는 광고 <strong>{adEnding.length}건</strong> ({adEnding.slice(0, 2).map((c) => c.advertiser).join(', ')}{adEnding.length > 2 ? ' 등' : ''}) — 재계약 연락</>}</p>}
              {adDue.length > 0 && <p>{lang === 'en' ? <>· Ad fees to collect <strong>{won(adDueSum, lang)}</strong> ({adDue.length} {adDue.length === 1 ? 'ad' : 'ads'})</> : <>· 받을 광고비 <strong>{won(adDueSum)}</strong> ({adDue.length}건)</>}</p>}
              <p className="mt-0.5 text-[12px] text-muted">{t('광고 계약 보기 ›', 'View ad contracts ›')}</p>
            </Link>
          )}
          {isEditorPlus && (
            <section className="rounded-lg border border-line bg-white">
              <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-[14px] font-bold">
                {t('승인 대기', 'Awaiting approval')}
                <span className="rounded-full bg-[#E8A93A] px-1.5 text-[11px] font-semibold text-[#2A1C00] tabular-nums">{counts[1].count ?? 0}</span>
              </h2>
              {reviewQueue.data?.length ? (
                <ul className="divide-y divide-line">
                  {(reviewQueue.data as any[]).map((a) => (
                    <li key={a.id}>
                      <Link href={`/articles/${a.id}`} className="block px-5 py-3 hover:bg-[#F8F9FA]">
                        <p className="truncate text-[13.5px] font-medium">{a.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted">{a.author?.full_name} · {t(`${formatDateTime(a.updated_at)} 신청`, `Submitted ${formatDateTime(a.updated_at, lang)}`)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] text-muted">{t('승인을 기다리는 기사가 없습니다.', 'No stories are awaiting approval.')}</p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-bold">{t('고객센터 소식', 'Support Center news')}</h2>
              <Link href="/support" className="text-[12px] text-muted hover:text-ink">{t('고객센터 ›', 'Support Center ›')}</Link>
            </div>
            <ul className="divide-y divide-line">
              {(notices ?? []).map((n) => (
                <li key={n.id}>
                  <Link href={`/support/notices/${n.id}`} className="flex items-center gap-2 px-5 py-2.5 hover:bg-[#F8F9FA]">
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold ${NOTICE_CATEGORIES[n.category as NoticeCategory].className}`}>{noticeCategoryLabel(n.category as NoticeCategory, lang)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{n.title}</span>
                  </Link>
                </li>
              ))}
              {(myTickets ?? []).map((tk) => (
                <li key={tk.id}>
                  <Link href={`/support/tickets/${tk.id}`} className="flex items-center gap-2 px-5 py-2.5 hover:bg-[#F8F9FA]">
                    <span className={`shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold ${TICKET_STATUS[tk.status as TicketStatus].className}`}>{ticketStatusLabel(tk.status as TicketStatus, lang)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">{tk.title}</span>
                    {hasUnreadReply(tk) && <span className="shrink-0 rounded bg-danger px-1 text-[10px] font-bold text-white">{t('새 답변', 'New reply')}</span>}
                  </Link>
                </li>
              ))}
              {!notices?.length && !myTickets?.length && (
                <li className="px-5 py-5 text-center text-[12.5px] text-muted">
                  {lang === 'en' ? <>If you need anything, leave a <Link href="/support/tickets/new" className="font-semibold text-ink underline underline-offset-2">request</Link>.</> : <>필요한 일이 있으면 <Link href="/support/tickets/new" className="font-semibold text-ink underline underline-offset-2">업무요청</Link>을 남겨 주세요.</>}
                </li>
              )}
            </ul>
          </section>

          <section className="rounded-lg border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3.5 text-[14px] font-bold">{t('많이 본 기사', 'Most read')}</h2>
            {popular.data?.length ? (
              <ol className="divide-y divide-line">
                {(popular.data as any[]).map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/articles/${a.id}`} className="flex gap-3 px-5 py-3 hover:bg-[#F8F9FA]">
                      <span className="w-4 shrink-0 text-[14px] font-bold tabular-nums text-[#2E8B57]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{a.title}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">{a.view_count ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-8 text-center text-[13px] text-muted">{t('아직 발행된 기사가 없습니다.', 'No stories have been published yet.')}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
