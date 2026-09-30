import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatShort } from '@/lib/format'
import { TICKET_CATEGORIES, TICKET_STATUS, won, type TicketCategory, type TicketStatus } from '@/lib/support'
import type { OutletSiteSettings } from '@/lib/sites'

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

export default async function DashboardPage() {
  const { supabase, isStaff, isSuper } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')

  const [{ data: groups }, outletsRes, statsRes, { count: pending }, { data: tickets }, { count: newLeads }, { data: leads }, { count: memberCount }] = await Promise.all([
    supabase.from('publishers').select('id, name').order('created_at'),
    supabase.from('outlets').select('*').order('created_at'),
    supabase.rpc('platform_outlet_stats'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false),
    supabase.from('support_tickets').select('id, title, status, category, created_at, outlet:outlets(name)').neq('status', 'done').order('created_at', { ascending: false }).limit(6),
    supabase.from('beta_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase.from('beta_requests').select('id, company, contact_name, outlet_count, status, created_at').neq('status', 'done').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ])

  if (statsRes.error) {
    return (
      <div className="mx-auto max-w-[900px] px-8 py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">대시보드를 쓰려면 Supabase에서 <code>supabase/staff.sql</code>을 실행해 주세요.</p>
      </div>
    )
  }

  const outlets = (outletsRes.data ?? []) as { id: string; name: string; domain: string | null; publisher_id: string | null; site?: OutletSiteSettings | null; created_at: string }[]
  const stats = new Map(((statsRes.data ?? []) as Stat[]).map((s) => [s.outlet_id, s]))
  const st = (id: string) => stats.get(id) ?? ({} as Partial<Stat>)
  const sum = (k: keyof Stat) => outlets.reduce((a, o) => a + Number(st(o.id)[k] ?? 0), 0)

  // 매체 상태: 운영(도메인 + 검색 노출) / 비공개(도메인만) / 준비(도메인 없음)
  const stateOf = (o: (typeof outlets)[number]) => (!o.domain ? 'prep' : o.site?.indexable ? 'live' : 'hidden')
  const legalDone = (o: (typeof outlets)[number]) => REQUIRED_LEGAL.filter((k) => o.site?.legal?.[k]?.trim()).length
  const live = outlets.filter((o) => stateOf(o) === 'live').length
  const unpaidCount = sum('unpaid_invoices')

  // 할 일: 사람이 확인해야 하는 것만 모은다
  const todos: { text: string; href: string }[] = []
  if ((pending ?? 0) > 0) todos.push({ text: `가입 승인 대기 ${pending}명${isSuper ? '' : ' (총관리자 처리)'}`, href: '/admin/users' })
  if ((newLeads ?? 0) > 0) todos.push({ text: `아직 연락하지 않은 상담 신청 ${newLeads}건`, href: '/admin/leads' })
  const received = (tickets ?? []).filter((t) => t.status === 'received').length
  if (received) todos.push({ text: `답변을 기다리는 업무요청 ${received}건`, href: '/support/tickets?tab=unread' })
  outlets.filter((o) => legalDone(o) < REQUIRED_LEGAL.length).forEach((o) => todos.push({ text: `${o.name}: 하단 필수 표시 정보 ${REQUIRED_LEGAL.length - legalDone(o)}개 비어 있음`, href: `/admin/outlets/${o.id}/site` }))
  outlets.filter((o) => o.domain && st(o.id).published_week === 0).forEach((o) => todos.push({ text: `${o.name}: 최근 7일 발행 기사 없음`, href: `/admin/outlets/${o.id}/site` }))

  const sections = [
    ...(groups ?? []).map((g) => ({ id: g.id as string, name: g.name as string, list: outlets.filter((o) => o.publisher_id === g.id) })),
    { id: 'none', name: '그룹 없음', list: outlets.filter((o) => !o.publisher_id || !(groups ?? []).some((g) => g.id === o.publisher_id)) },
  ].filter((s) => s.list.length || s.id !== 'none')

  const today = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">운영 대시보드</h1>
          <p className="mt-1 text-[13px] text-muted">{today} · 모든 그룹과 매체의 현황</p>
        </div>
        <div className="flex gap-2"><Link href="/admin/ai-compare" className="btn-secondary bg-white">AI 모델 비교</Link><Link href="/admin/outlets" className="btn-primary">그룹·매체 관리</Link></div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="그룹" value={(groups ?? []).length} sub="고객 언론사·발행인" />
        <Kpi label="매체" value={outlets.length} sub={`운영 ${live} · 준비 ${outlets.length - live}`} />
        <Kpi label="오늘 발행" value={sum('published_today')} sub="전체 매체 기사" tone="good" />
        <Kpi label="최근 7일 발행" value={sum('published_week')} sub={`누적 ${sum('published').toLocaleString()}건`} />
        <Kpi label="전체 회원" value={memberCount ?? 0} sub={`승인 대기 ${pending ?? 0}`} tone={pending ? 'alert' : 'default'} href="/admin/users" />
        <Kpi label="새 업무요청" value={received} sub={`처리 중 ${(tickets ?? []).length}건`} tone={received ? 'alert' : 'default'} href="/support/tickets" />
        <Kpi label="새 상담 신청" value={newLeads ?? 0} sub="소개 페이지 베타 신청" tone={newLeads ? 'alert' : 'default'} href="/admin/leads" />
        <Kpi label="미납 청구서" value={unpaidCount} sub={won(sum('unpaid_total'))} tone={unpaidCount ? 'alert' : 'default'} href="/support/invoices" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {sections.map((g) => (
            <section key={g.id} className="overflow-hidden rounded-xl border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line bg-[#F8F9FA] px-5 py-3">
                <h2 className="text-[15.5px] font-extrabold">{g.name}</h2>
                <span className="text-[12.5px] text-muted">
                  매체 {g.list.length} · 7일 발행 {g.list.reduce((a, o) => a + Number(st(o.id).published_week ?? 0), 0)} · 회원 {g.list.reduce((a, o) => a + Number(st(o.id).members ?? 0), 0)}
                </span>
              </div>
              {g.list.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11.5px] text-muted">
                        <th className="px-5 py-2 font-medium">매체</th>
                        <th className="px-2 py-2 font-medium">홈페이지</th>
                        <th className="px-2 py-2 font-medium">설정</th>
                        <th className="px-2 py-2 text-right font-medium">오늘</th>
                        <th className="px-2 py-2 text-right font-medium">7일</th>
                        <th className="px-2 py-2 text-right font-medium">승인대기</th>
                        <th className="px-2 py-2 font-medium">최근 발행</th>
                        <th className="px-2 py-2 text-right font-medium">회원</th>
                        <th className="px-2 py-2 text-right font-medium">요청</th>
                        <th className="px-2 py-2 text-right font-medium">미납</th>
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
                            <td className="px-5 py-3 font-bold">{o.name}</td>
                            <td className="px-2 py-3">
                              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${state === 'live' ? 'bg-published/10 text-published' : state === 'hidden' ? 'bg-draft/15 text-[#6B5F22]' : 'bg-line text-muted'}`}>
                                {state === 'live' ? '운영' : state === 'hidden' ? '비공개' : '준비'}
                              </span>
                              <span className="ml-1.5 text-[11.5px] text-muted">{o.domain ?? '도메인 없음'}</span>
                            </td>
                            <td className="px-2 py-3">
                              <span className="flex items-center gap-1.5" title={`필수 표시 정보 ${done}/${REQUIRED_LEGAL.length}`}>
                                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
                                  <span className={`block h-full ${done === REQUIRED_LEGAL.length ? 'bg-published' : 'bg-draft'}`} style={{ width: `${(done / REQUIRED_LEGAL.length) * 100}%` }} />
                                </span>
                                <span className="text-[11px] text-muted">{done}/{REQUIRED_LEGAL.length}</span>
                              </span>
                            </td>
                            <td className="px-2 py-3 text-right font-semibold">{s.published_today ?? 0}</td>
                            <td className={`px-2 py-3 text-right ${o.domain && !s.published_week ? 'text-danger' : ''}`}>{s.published_week ?? 0}</td>
                            <td className="px-2 py-3 text-right">{s.drafts_in_review || ''}</td>
                            <td className="px-2 py-3 text-[12px] text-muted">{s.last_published_at ? formatShort(s.last_published_at) : '-'}</td>
                            <td className="px-2 py-3 text-right">{s.members ?? 0}</td>
                            <td className={`px-2 py-3 text-right ${s.open_tickets ? 'font-bold text-danger' : ''}`}>{s.open_tickets || ''}</td>
                            <td className={`px-2 py-3 text-right ${s.unpaid_invoices ? 'font-bold text-danger' : ''}`}>{s.unpaid_invoices ? won(s.unpaid_total) : ''}</td>
                            <td className="whitespace-nowrap px-5 py-3 text-right text-[12px]">
                              <a href={o.domain ? `https://${o.domain}` : `/?preview_outlet=${o.id}`} target="_blank" rel="noopener" className="text-muted underline underline-offset-2 hover:text-ink">홈페이지</a>
                              <Link href={`/admin/outlets/${o.id}/site`} className="ml-2.5 text-muted underline underline-offset-2 hover:text-ink">설정</Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-5 py-6 text-center text-[13px] text-muted">아직 매체가 없습니다. 그룹·매체 관리에서 만들 수 있습니다.</p>
              )}
            </section>
          ))}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-[14px] font-bold">확인할 일 <span className="ml-1 rounded-full bg-danger px-1.5 text-[11px] text-white">{todos.length}</span></h2>
            {todos.length ? (
              <ul className="divide-y divide-line">
                {todos.slice(0, 12).map((t, i) => (
                  <li key={i}><Link href={t.href} className="block px-5 py-2.5 text-[13px] hover:bg-[#F8F9FA]">• {t.text}</Link></li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-[13px] text-muted">지금 처리할 일이 없습니다 👍</p>
            )}
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[14px] font-bold">처리 중인 업무요청</h2>
              <Link href="/support/tickets" className="text-[12px] text-muted hover:text-ink">전체 ›</Link>
            </div>
            <ul className="divide-y divide-line">
              {(tickets ?? []).map((t: any) => (
                <li key={t.id}>
                  <Link href={`/support/tickets/${t.id}`} className="block px-5 py-2.5 hover:bg-[#F8F9FA]">
                    <p className="flex items-center gap-1.5 text-[11px]">
                      <span className={`rounded px-1.5 py-px font-semibold ${TICKET_STATUS[t.status as TicketStatus].className}`}>{TICKET_STATUS[t.status as TicketStatus].label}</span>
                      <span className="text-muted">{t.outlet?.name ?? ''} · {TICKET_CATEGORIES[t.category as TicketCategory]}</span>
                    </p>
                    <p className="mt-1 truncate text-[13px] font-medium">{t.title}</p>
                  </Link>
                </li>
              ))}
              {!tickets?.length && <li className="px-5 py-5 text-center text-[12.5px] text-muted">처리 중인 요청이 없습니다.</li>}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-[14px] font-bold">상담 신청</h2>
              <Link href="/admin/leads" className="text-[12px] text-muted hover:text-ink">전체 ›</Link>
            </div>
            <ul className="divide-y divide-line">
              {(leads ?? []).map((l: any) => (
                <li key={l.id}>
                  <Link href="/admin/leads" className="flex items-center gap-2 px-5 py-2.5 text-[13px] hover:bg-[#F8F9FA]">
                    {l.status === 'new' && <span className="rounded bg-danger px-1 text-[10.5px] font-bold text-white">새</span>}
                    <span className="min-w-0 flex-1 truncate font-medium">{l.company}</span>
                    <span className="text-[11.5px] text-muted">{formatShort(l.created_at)}</span>
                  </Link>
                </li>
              ))}
              {!leads?.length && <li className="px-5 py-5 text-center text-[12.5px] text-muted">처리할 상담이 없습니다.</li>}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
