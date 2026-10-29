import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { isDormant } from '@/lib/device'
import { formatShort } from '@/lib/format'
import { outletHomeUrl } from '@/lib/product'
import { TICKET_STATUS, ticketCategoryLabel, ticketStatusLabel, won as wonK, type TicketCategory, type TicketStatus } from '@/lib/support'
import type { OutletSiteSettings } from '@/lib/sites'
import ConfirmSubmit from '@/components/cms/ConfirmSubmit'
import { removeGroup, removeOutlet } from './actions'
import { isPrepNow } from '@/lib/sites'

// 인터넷신문 필수 표시 항목 (홈페이지 설정과 같은 기준)
const REQUIRED_LEGAL = ['company', 'registrationNo', 'registeredAt', 'publisher', 'editor', 'youthOfficer', 'phone', 'address'] as const

type Stat = {
  outlet_id: string; published: number; published_today: number; published_week: number; drafts_in_review: number
  last_published_at: string | null; members: number; open_tickets: number; unpaid_invoices: number; unpaid_total: number
}

function Kpi({ label, value, sub, tone = 'default', href }: { label: string; value: string | number; sub?: string; tone?: 'default' | 'alert' | 'good'; href?: string }) {
  const body = (
    <div className={`h-full rounded-xl border bg-white px-5 py-4 ${tone === 'alert' ? 'border-danger/40' : 'border-line'} ${href ? 'transition hover:border-ink' : ''}`}>
      <p className="text-[12.5px] font-semibold text-muted">{label}</p>
      <p className={`mt-1.5 text-[28px] font-extrabold leading-none tabular-nums ${tone === 'alert' ? 'text-danger' : tone === 'good' ? 'text-published' : ''}`}>{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{body}</Link> : body
}

export default async function DashboardPage(props: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const searchParams = await props.searchParams
  const { supabase, isStaff, isSuper } = await getCmsContext()
  const { t, lang } = await getT()
  const won = (n: number | null | undefined) => wonK(n, lang)
  if (!isStaff) redirect('/newsroom')

  const [groupsRes, outletsRes, statsRes, { count: pending }, { data: tickets }, { count: newLeads }, { data: leads }, { count: memberCount }] = await Promise.all([
    supabase.from('publishers').select('id, name, solo').order('created_at'),
    supabase.from('outlets').select('*').order('created_at'),
    supabase.rpc('platform_outlet_stats'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false),
    supabase.from('support_tickets').select('id, title, status, category, created_at, outlet:outlets(name)').neq('status', 'done').order('created_at', { ascending: false }).limit(6),
    supabase.from('beta_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('beta_requests').select('id, company, contact_name, outlet_count, status, created_at').neq('status', 'done').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  // group-solo.sql 전에는 solo 칸이 없다 → 모두 일반 그룹으로
  const groups = ((groupsRes.error ? (await supabase.from('publishers').select('id, name').order('created_at')).data : groupsRes.data) ?? []) as { id: string; name: string; solo?: boolean }[]
  if (statsRes.error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('대시보드를 쓰려면 Supabase에서', 'To use the dashboard, run')} <code>supabase/staff.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}</p>
      </div>
    )
  }

  const outlets = (outletsRes.data ?? []) as { id: string; name: string; domain: string | null; publisher_id: string | null; site?: OutletSiteSettings | null; created_at: string }[]
  const stats = new Map(((statsRes.data ?? []) as Stat[]).map((s) => [s.outlet_id, s]))
  const st = (id: string) => stats.get(id) ?? ({} as Partial<Stat>)
  const sum = (k: keyof Stat) => outlets.reduce((a, o) => a + Number(st(o.id)[k] ?? 0), 0)

  // 매체 상태: 운영(도메인 + 검색 노출) / 비공개(도메인만) / 준비(도메인 없음 또는 오픈 준비 중 스위치 켜짐)
  const stateOf = (o: (typeof outlets)[number]) => (!o.domain || isPrepNow((o.site ?? {}) as { comingSoon?: boolean; openAt?: string }) ? 'prep' : o.site?.indexable ? 'live' : 'hidden')
  const legalDone = (o: (typeof outlets)[number]) => REQUIRED_LEGAL.filter((k) => o.site?.legal?.[k]?.trim()).length
  const live = outlets.filter((o) => stateOf(o) === 'live').length
  const unpaidCount = sum('unpaid_invoices')

  // 할 일: 사람이 확인해야 하는 것만 모은다
  const todos: { text: string; href: string }[] = []
  if ((pending ?? 0) > 0) todos.push({ text: t(`가입 승인 대기 ${pending}명${isSuper ? '' : ' (총관리자 처리)'}`, `${pending} ${pending === 1 ? 'sign-up' : 'sign-ups'} awaiting approval${isSuper ? '' : ' (handled by a Super Admin)'}`), href: '/admin/users' })
  if ((newLeads ?? 0) > 0) todos.push({ text: t(`아직 연락하지 않은 상담 신청 ${newLeads}건`, `${newLeads} consultation ${newLeads === 1 ? 'request' : 'requests'} not yet contacted`), href: '/admin/leads' })
  const received = (tickets ?? []).filter((tk) => tk.status === 'received').length
  if (received) todos.push({ text: t(`답변을 기다리는 업무요청 ${received}건`, `${received} work ${received === 1 ? 'request' : 'requests'} awaiting a reply`), href: '/support/tickets?tab=unread' })
  // 1년 이상 접속하지 않은 회원 (총관리자만, login-security.sql 전이면 건너뛴다)
  if (isSuper) {
    const [seenRes, { data: people }] = await Promise.all([
      supabase.rpc('member_last_seen'),
      supabase.from('profiles').select('id, created_at, suspended_at, is_super, approved'),
    ])
    if (!seenRes.error) {
      const seen = new Map(((seenRes.data ?? []) as { id: string; last_seen: string | null }[]).map((r) => [r.id, r.last_seen]))
      const dormant = ((people ?? []) as { id: string; created_at: string; suspended_at?: string | null; is_super?: boolean; approved?: boolean }[])
        .filter((p) => p.approved !== false && !p.is_super && !p.suspended_at && isDormant(seen.get(p.id), p.created_at)).length
      if (dormant) todos.push({ text: t(`1년 이상 접속하지 않은 회원 ${dormant}명 (출입 정지 검토)`, `${dormant} ${dormant === 1 ? 'member has' : 'members have'} not logged in for over a year (consider suspending access)`), href: '/admin/users' })
    }
  }
  outlets.filter((o) => legalDone(o) < REQUIRED_LEGAL.length).forEach((o) => todos.push({ text: t(`${o.name}: 하단 필수 표시 정보 ${REQUIRED_LEGAL.length - legalDone(o)}개 비어 있음`, `${o.name}: ${REQUIRED_LEGAL.length - legalDone(o)} required footer ${REQUIRED_LEGAL.length - legalDone(o) === 1 ? 'item is' : 'items are'} empty`), href: `/admin/outlets/${o.id}/site` }))
  outlets.filter((o) => o.domain && st(o.id).published_week === 0).forEach((o) => todos.push({ text: t(`${o.name}: 최근 7일 발행 기사 없음`, `${o.name}: no stories published in the last 7 days`), href: `/admin/outlets/${o.id}/site` }))

  // 언론사는 대부분 매체 1개를 혼자 운영하므로 기본은 '개별 매체'로 보여 주고, 매체가 2개 이상 묶인 그룹만 그룹으로 나눈다
  //   (매체가 1개뿐인 그룹도 개별 매체 칸에 보인다 — 화면만 그렇게 모을 뿐 그룹 자체는 그대로다) · 매체가 없는 그룹은 맨 아래에 따로 모아 지울 수 있게 한다
  const realList = groups.filter((g) => !g.solo)
  const countOf = (gid: string) => outlets.filter((o) => o.publisher_id === gid).length
  const multi = realList.filter((g) => countOf(g.id) >= 2)
  const multiIds = new Set(multi.map((g) => g.id))
  const emptyGroups = realList.filter((g) => countOf(g.id) === 0)
  const sections = [
    ...multi.map((g) => ({ id: g.id, name: g.name, note: '', list: outlets.filter((o) => o.publisher_id === g.id), deletable: true })),
    { id: 'solo', name: t('개별 매체', 'Standalone outlets'), note: t('그룹 없이 혼자 운영하는 언론사', 'Single outlets run on their own, without a group'), list: outlets.filter((o) => o.publisher_id && !multiIds.has(o.publisher_id) && groups.some((g) => g.id === o.publisher_id)), deletable: false },
    { id: 'none', name: t('그룹 없음', 'No group'), note: '', list: outlets.filter((o) => !o.publisher_id || !groups.some((g) => g.id === o.publisher_id)), deletable: false },
  ].filter((s) => s.list.length)
  const realGroups = multi.length
  const standaloneCount = outlets.filter((o) => o.publisher_id && !multiIds.has(o.publisher_id)).length

  const today = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">{t('운영 대시보드', 'Operations dashboard')}</h1>
          <p className="mt-1 text-[13px] text-muted">{today} · {t('모든 그룹과 매체의 현황', 'Status of all groups and outlets')}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/admin/ai-usage" className="btn-secondary bg-white">{t('요금제·AI 사용량', 'Plans · AI usage')}</Link><Link href="/admin/ai-compare" className="btn-secondary bg-white">{t('AI 모델 비교', 'AI model comparison')}</Link><Link href="/admin/outlets" className="btn-primary">{t('그룹·매체 관리', 'Groups & outlets')}</Link></div>
      </header>

      {searchParams.error && <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13.5px] text-danger">{searchParams.error}</p>}
      {searchParams.ok && <p role="status" className="mb-4 rounded-lg border border-published/30 bg-published/5 px-4 py-3 text-[13.5px] text-published">{searchParams.ok}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label={t('그룹', 'Groups')} value={realGroups} sub={t(`개별 매체 ${standaloneCount}곳`, `${standaloneCount} standalone`)} />
        <Kpi label={t('매체', 'Outlets')} value={outlets.length} sub={t(`운영 ${live} · 준비 ${outlets.length - live}`, `${live} live · ${outlets.length - live} in prep`)} />
        <Kpi label={t('오늘 발행', 'Published today')} value={sum('published_today')} sub={t('전체 매체 기사', 'Stories across all outlets')} tone="good" />
        <Kpi label={t('최근 7일 발행', 'Last 7 days')} value={sum('published_week')} sub={t(`누적 ${sum('published').toLocaleString()}건`, `${sum('published').toLocaleString('en-US')} total`)} />
        <Kpi label={t('전체 회원', 'All members')} value={memberCount ?? 0} sub={t(`승인 대기 ${pending ?? 0}`, `${pending ?? 0} awaiting approval`)} tone={pending ? 'alert' : 'default'} href="/admin/users" />
        <Kpi label={t('새 업무요청', 'New work requests')} value={received} sub={t(`처리 중 ${(tickets ?? []).length}건`, `${(tickets ?? []).length} open`)} tone={received ? 'alert' : 'default'} href="/support/tickets" />
        <Kpi label={t('새 상담 신청', 'New consultation requests')} value={newLeads ?? 0} sub={t('소개 페이지 베타 신청', 'Beta sign-ups from the product page')} tone={newLeads ? 'alert' : 'default'} href="/admin/leads" />
        <Kpi label={t('미납 청구서', 'Unpaid invoices')} value={unpaidCount} sub={won(sum('unpaid_total'))} tone={unpaidCount ? 'alert' : 'default'} href="/support/invoices" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          {sections.map((g) => (
            <section key={g.id} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-[#F8F9FA] px-5 py-3">
                <h2 className="text-[15.5px] font-extrabold">{g.name}{g.note && <span className="ml-2 text-[12px] font-normal text-muted">{g.note}</span>}</h2>
                <span className="flex items-center gap-3 text-[12.5px] text-muted">
                  {t('매체', 'Outlets')} {g.list.length} · {t('7일 발행', '7-day stories')} {g.list.reduce((a, o) => a + Number(st(o.id).published_week ?? 0), 0)} · {t('회원', 'Members')} {g.list.reduce((a, o) => a + Number(st(o.id).members ?? 0), 0)}
                  {isSuper && g.deletable && !g.list.some((o) => o.site?.trial) && (
                    <form action={removeGroup.bind(null, g.id)}>
                      <ConfirmSubmit
                        message={g.list.length ? t(`‘${g.name}’ 그룹을 지울까요?\n안의 매체 ${g.list.length}개는 지워지지 않고 '개별 매체'로 옮겨집니다.`, `Delete the group “${g.name}”?\nThe ${g.list.length} ${g.list.length === 1 ? 'outlet' : 'outlets'} inside will not be deleted; they will be moved to 'Standalone outlets'.`) : t(`빈 그룹 ‘${g.name}’을(를) 지울까요?`, `Delete the empty group “${g.name}”?`)}
                        className="text-[12px] text-muted underline underline-offset-2 hover:text-danger"
                      >
                        {t('그룹 삭제', 'Delete group')}
                      </ConfirmSubmit>
                    </form>
                  )}
                </span>
              </div>
              {g.list.length ? (
                <div className="overflow-x-auto">
                  <table className="table-cards w-full text-[13px] md:min-w-[640px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11.5px] text-muted">
                        <th className="px-5 py-2 font-medium">{t('매체', 'Outlet')}</th>
                        <th className="px-2 py-2 font-medium">{t('홈페이지', 'Homepage')}</th>
                        <th className="px-2 py-2 font-medium">{t('설정', 'Setup')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('오늘', 'Today')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('7일', '7 days')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('승인대기', 'Pending')}</th>
                        <th className="px-2 py-2 font-medium">{t('최근 발행', 'Last published')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('회원', 'Members')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('요청', 'Requests')}</th>
                        <th className="px-2 py-2 text-right font-medium">{t('미납', 'Unpaid')}</th>
                        <th className="px-5 py-2" />
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {g.list.map((o) => {
                        const s = st(o.id)
                        const state = stateOf(o)
                        const done = legalDone(o)
                        return (
                          <tr key={o.id} className="border-b border-line/60 last:border-0 hover:bg-[#FAFBFC]">
                            <td className="tc-full px-5 py-3 font-bold">{o.name}</td>
                            <td className="px-2 py-3">
                              <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${state === 'live' ? 'bg-published/10 text-published' : state === 'hidden' ? 'bg-draft/15 text-[#6B5F22]' : 'bg-line text-muted'}`}>
                                {state === 'live' ? t('운영', 'Live') : state === 'hidden' ? t('비공개', 'Hidden') : t('준비', 'In prep')}
                              </span>
                              <span className="ml-1.5 break-all text-[11.5px] text-muted">{o.domain ?? t('도메인 없음', 'No domain')}</span>
                            </td>
                            <td data-label={t('설정', 'Setup')} className="px-2 py-3">
                              <span className="inline-flex items-center gap-1.5 md:flex" title={t(`필수 표시 정보 ${done}/${REQUIRED_LEGAL.length}`, `Required footer info ${done}/${REQUIRED_LEGAL.length}`)}>
                                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
                                  <span className={`block h-full ${done === REQUIRED_LEGAL.length ? 'bg-published' : 'bg-draft'}`} style={{ width: `${(done / REQUIRED_LEGAL.length) * 100}%` }} />
                                </span>
                                <span className="text-[11px] text-muted">{done}/{REQUIRED_LEGAL.length}</span>
                              </span>
                            </td>
                            <td data-label={t('오늘', 'Today')} className="px-2 py-3 text-right font-semibold">{s.published_today ?? 0}</td>
                            <td data-label={t('7일', '7 days')} className={`px-2 py-3 text-right ${o.domain && !s.published_week ? 'text-danger' : ''}`}>{s.published_week ?? 0}</td>
                            <td data-label={t('승인대기', 'Pending')} className="px-2 py-3 text-right">{s.drafts_in_review || ''}</td>
                            <td data-label={t('최근 발행', 'Last published')} className="px-2 py-3 text-[12px] text-muted">{s.last_published_at ? formatShort(s.last_published_at, lang) : '-'}</td>
                            <td data-label={t('회원', 'Members')} className="px-2 py-3 text-right">{s.members ?? 0}</td>
                            <td data-label={t('요청', 'Requests')} className={`px-2 py-3 text-right ${s.open_tickets ? 'font-bold text-danger' : ''}`}>{s.open_tickets || ''}</td>
                            <td data-label={t('미납', 'Unpaid')} className={`px-2 py-3 text-right ${s.unpaid_invoices ? 'font-bold text-danger' : ''}`}>{s.unpaid_invoices ? won(s.unpaid_total) : ''}</td>
                            <td className="tc-full whitespace-nowrap px-5 py-3 text-right text-[12px]">
                              <a href={outletHomeUrl(o)} target="_blank" rel="noopener" className="text-muted underline underline-offset-2 hover:text-ink">{t('홈페이지', 'Homepage')}</a>
                              <Link href={`/admin/outlets/${o.id}/site`} className="ml-2.5 text-muted underline underline-offset-2 hover:text-ink">{t('설정', 'Setup')}</Link>
                              {isSuper && !s.published && !s.members && !s.drafts_in_review && !o.site?.trial && (
                                <form action={removeOutlet.bind(null, o.id)} className="ml-2.5 inline">
                                  <ConfirmSubmit message={t(`‘${o.name}’ 매체를 지울까요?\n기사·회원·청구서가 없는 매체만 지워지며, 섹션·홈페이지 설정도 함께 지워집니다. 되돌릴 수 없습니다.`, `Delete the outlet “${o.name}”?\nOnly outlets with no stories, members or invoices can be deleted, and its sections and homepage settings are deleted with it. This cannot be undone.`)} className="text-muted underline underline-offset-2 hover:text-danger">{t('삭제', 'Delete')}</ConfirmSubmit>
                                </form>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-6 text-center text-[13px] text-muted">{t('아직 매체가 없습니다. 그룹·매체 관리에서 만들거나, 쓰지 않는 그룹이면 위의 “그룹 삭제”로 지우세요.', 'No outlets yet. Create one under Groups & outlets, or if the group is unused, delete it with “Delete group” above.')}</p>
              )}
            </section>
          ))}
          {isSuper && emptyGroups.length > 0 && (
            <section className="rounded-xl border border-dashed border-line bg-white px-5 py-3.5">
              <p className="text-[13px] font-bold">{t('비어 있는 그룹', 'Empty groups')} <span className="font-normal text-muted">{t('매체가 하나도 없는 그룹입니다. 쓰지 않으면 지우세요.', 'These groups have no outlets. Delete them if unused.')}</span></p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {emptyGroups.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[12.5px]">
                    {g.name}
                    <form action={removeGroup.bind(null, g.id)}>
                      <ConfirmSubmit message={t(`빈 그룹 ‘${g.name}’을(를) 지울까요?`, `Delete the empty group “${g.name}”?`)} className="text-muted underline underline-offset-2 hover:text-danger">{t('삭제', 'Delete')}</ConfirmSubmit>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-[14px] font-bold">{t('확인할 일', 'To check')} <span className="ml-1 rounded-full bg-danger px-1.5 text-[11px] text-white">{todos.length}</span></h2>
            {todos.length ? (
              <ul className="divide-y divide-line">
                {todos.slice(0, 12).map((td, i) => (
                  <li key={i}><Link href={td.href} className="block px-5 py-2.5 text-[13px] hover:bg-[#F8F9FA]">• {td.text}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-[13px] text-muted">{t('지금 처리할 일이 없습니다 👍', 'Nothing to take care of right now 👍')}</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[14px] font-bold">{t('처리 중인 업무요청', 'Open work requests')}</h2>
              <Link href="/support/tickets" className="text-[12px] text-muted hover:text-ink">{t('전체 ›', 'All ›')}</Link>
            </div>
            <ul className="divide-y divide-line">
              {(tickets ?? []).map((tk: any) => (
                <li key={tk.id}>
                  <Link href={`/support/tickets/${tk.id}`} className="block px-5 py-2.5 hover:bg-[#F8F9FA]">
                    <p className="flex items-center gap-1.5 text-[11px]">
                      <span className={`rounded px-1.5 py-px font-semibold ${TICKET_STATUS[tk.status as TicketStatus].className}`}>{ticketStatusLabel(tk.status as TicketStatus, lang)}</span>
                      <span className="text-muted">{tk.outlet?.name ?? ''} · {ticketCategoryLabel(tk.category as TicketCategory, lang)}</span>
                    </p>
                    <p className="mt-1 truncate text-[13px] font-medium">{tk.title}</p>
                  </Link>
                </li>
              ))}
              {!tickets?.length && <li className="px-5 py-5 text-center text-[12.5px] text-muted">{t('처리 중인 요청이 없습니다.', 'There are no open requests.')}</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[14px] font-bold">{t('상담 신청', 'Consultation requests')}</h2>
              <Link href="/admin/leads" className="text-[12px] text-muted hover:text-ink">{t('전체 ›', 'All ›')}</Link>
            </div>
            <ul className="divide-y divide-line">
              {(leads ?? []).map((l: any) => (
                <li key={l.id}>
                  <Link href="/admin/leads" className="flex items-center gap-2 px-5 py-2.5 text-[13px] hover:bg-[#F8F9FA]">
                    {l.status === 'new' && <span className="rounded bg-danger px-1 text-[10.5px] font-bold text-white">{t('새', 'New')}</span>}
                    <span className="min-w-0 flex-1 truncate font-medium">{l.company}</span>
                    <span className="text-[11.5px] text-muted">{formatShort(l.created_at, lang)}</span>
                  </Link>
                </li>
              ))}
              {!leads?.length && <li className="px-5 py-5 text-center text-[12.5px] text-muted">{t('처리할 상담이 없습니다.', 'There are no consultations to handle.')}</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
