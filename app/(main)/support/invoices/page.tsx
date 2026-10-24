import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { monthLabel, won } from '@/lib/support'
import { kstToday } from '@/lib/billing'

type Inv = { id: string; month: string; total: number; status: 'unpaid' | 'paid'; due_date: string | null; outlet_id: string; outlet_name?: string | null; outlet: { name: string } | null }
type Kind = 'hold' | 'failed' | 'overdue' | 'scheduled' | 'waiting' | 'paid'
const KIND: Record<Kind, { label: string; cls: string }> = {
  hold: { label: '이용 제한 중', cls: 'bg-danger text-white' },
  failed: { label: '결제 실패', cls: 'bg-danger/10 text-danger' },
  overdue: { label: '기한 지남', cls: 'bg-danger/10 text-danger' },
  scheduled: { label: '자동 결제 예정', cls: 'bg-[#EEF3FF] text-[#2F6BF0]' },
  waiting: { label: '납부 대기', cls: 'bg-draft/15 text-[#6B5F22]' },
  paid: { label: '납부 완료', cls: 'bg-published/10 text-published' },
}
const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number)
  const t = y * 12 + (mo - 1) + d
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

export default async function InvoicesPage(props: { searchParams: Promise<{ month?: string; show?: string }> }) {
  const sp = await props.searchParams
  const { supabase, isSuper, isStaff, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/support')
  if (isStaff) return <StaffDashboard supabase={supabase} isSuper={isSuper} month={/^\d{4}-\d{2}$/.test(sp.month ?? '') ? sp.month! : kstToday().slice(0, 7)} show={sp.show ?? ''} />
  const { data } = await supabase.from('invoices').select('*, outlet:outlets(name)').order('month', { ascending: false }).limit(120)

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">청구서</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{isStaff ? '모든 회원사의 청구서입니다.' : '우리 매체의 월별 청구서입니다. 편집장 이상만 볼 수 있습니다.'}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {isStaff && <Link href="/support/invoices/auto" className="rounded-full border border-line bg-white px-5 py-2 text-[14px] font-bold hover:border-ink">자동 청구</Link>}
          {isSuper && <Link href="/support/invoices/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[14px] font-bold text-white hover:opacity-90">+ 청구서 발행</Link>}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {(data ?? []).map((i: any) => (
          <li key={i.id}>
            <Link href={`/support/invoices/${i.id}`} className="flex items-center gap-2 px-2 py-4 hover:bg-white sm:gap-4">
              {/* 휴대폰에서는 매체 이름을 달 아래로 내려 한 줄에 다 들어가게 */}
              <span className="flex shrink-0 flex-col sm:flex-row sm:items-center sm:gap-4">
              <span className="w-28 font-bold">{monthLabel(i.month)}</span>
              {isStaff && <span className="w-28 truncate text-[13.5px] text-muted sm:w-40">{i.outlet?.name ?? (i.outlet_name ? `${i.outlet_name} (해지)` : "")}</span>}
              </span>
              <span className="flex-1 text-right text-[16px] font-bold tabular-nums">{won(i.total)}</span>
              <span className={`w-20 shrink-0 whitespace-nowrap rounded px-2 py-1 text-center text-[12px] font-semibold ${i.status === 'paid' ? 'bg-published/10 text-published' : 'bg-danger/10 text-danger'}`}>{i.status === 'paid' ? '납부 완료' : '미납'}</span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
        {!data?.length && <li className="py-16 text-center text-muted">발행된 청구서가 없습니다.</li>}
      </ul>
    </div>
  )
}

// 운영팀: 결제 현황 — 이번 달 요약, 조치가 필요한 매체(결제 실패·기한 지남·이용 제한), 전체 목록
async function StaffDashboard({ supabase, isSuper, month, show }: { supabase: Awaited<ReturnType<typeof getCmsContext>>['supabase']; isSuper: boolean; month: string; show: string }) {
  const today = kstToday()
  const [{ data: monthRows }, { data: unpaidRows }, { data: outlets }, { data: cards }] = await Promise.all([
    supabase.from('invoices').select('id, month, total, status, due_date, outlet_id, outlet_name, outlet:outlets(name)').eq('month', `${month}-01`).order('created_at').limit(1000),
    supabase.from('invoices').select('id, month, total, status, due_date, outlet_id, outlet_name, outlet:outlets(name)').eq('status', 'unpaid').order('month').limit(1000),
    supabase.from('outlets').select('id, billing_hold'),
    supabase.from('outlet_autopay').select('outlet_id, last_error').eq('active', true),
  ])
  const monthInv = (monthRows ?? []) as unknown as Inv[]
  const unpaidInv = (unpaidRows ?? []) as unknown as Inv[]
  const hold = new Set(((outlets ?? []) as { id: string; billing_hold: boolean | null }[]).filter((o) => o.billing_hold).map((o) => o.id))
  const card = new Map(((cards ?? []) as { outlet_id: string; last_error: string | null }[]).map((c) => [c.outlet_id, c]))
  const ids = Array.from(new Set([...monthInv, ...unpaidInv].map((i) => i.id)))
  // 결제 실패 사유 (청구서마다 가장 최근 실패)
  const failMsg = new Map<string, string>()
  // 청구서 번호를 한꺼번에 넣으면 주소가 너무 길어져서 100개씩 나눠 읽는다
  const done = new Set<string>()
  for (let n = 0; n < ids.length; n += 100) {
    const { data: pays } = await supabase.from('payments').select('invoice_id, status, fail_message, created_at').in('invoice_id', ids.slice(n, n + 100)).eq('test_mode', false).order('created_at', { ascending: false }).limit(1000)
    for (const p of (pays ?? []) as { invoice_id: string; status: string; fail_message: string | null }[]) {
      if (p.status === 'done') done.add(p.invoice_id)
      else if (p.status === 'failed' && !done.has(p.invoice_id) && !failMsg.has(p.invoice_id)) failMsg.set(p.invoice_id, p.fail_message ?? '결제가 완료되지 않았습니다.')
    }
  }
  const kindOf = (i: Inv): Kind => {
    if (i.status === 'paid') return 'paid'
    if (hold.has(i.outlet_id)) return 'hold'
    if (failMsg.has(i.id) && card.has(i.outlet_id)) return 'failed'
    if (i.due_date && i.due_date < today) return 'overdue'
    return card.has(i.outlet_id) ? 'scheduled' : 'waiting'
  }
  const nameOf = (i: Inv) => i.outlet?.name ?? (i.outlet_name ? `${i.outlet_name} (해지)` : '-')
  // 조치가 필요한 것: 어느 달이든 미납이면서 이용 제한·결제 실패·기한 지남
  const attention = unpaidInv.map((i) => ({ i, k: kindOf(i) })).filter((x) => x.k === 'hold' || x.k === 'failed' || x.k === 'overdue')
    .sort((a, b) => ['hold', 'failed', 'overdue'].indexOf(a.k) - ['hold', 'failed', 'overdue'].indexOf(b.k))
  const rows = monthInv.map((i) => ({ i, k: kindOf(i) }))
  const count = (k: Kind) => rows.filter((r) => r.k === k).length
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((n, r) => n + Number(r.i.total), 0)
  const shown = show && show in KIND ? rows.filter((r) => r.k === show || (show === 'overdue' && r.k === 'hold')) : rows
  const link = (m: string, sh = '') => `/support/invoices?month=${m}${sh ? `&show=${sh}` : ''}`

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">청구서·결제 현황</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">모든 매체의 청구서와 결제 상태입니다. 문제가 있는 매체가 맨 위에 나옵니다.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/support/invoices/auto" className="rounded-full border border-line bg-white px-5 py-2 text-[14px] font-bold hover:border-ink">자동 청구</Link>
          {isSuper && <Link href="/support/invoices/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[14px] font-bold text-white hover:opacity-90">+ 청구서 발행</Link>}
        </div>
      </div>

      <section className="mt-5" aria-labelledby="attn-title">
        <h2 id="attn-title" className="text-[15px] font-bold">조치가 필요한 매체 <span className={`ml-1 rounded px-2 py-0.5 text-[12px] ${attention.length ? 'bg-danger text-white' : 'bg-published/10 text-published'}`}>{attention.length ? `${attention.length}곳` : '없음'}</span></h2>
        {attention.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl bg-white ring-1 ring-black/5">
            {attention.map(({ i, k }) => (
              <li key={i.id}>
                <Link href={`/support/invoices/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-[#F8F9FA]">
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[12px] font-semibold ${KIND[k].cls}`}>{KIND[k].label}</span>
                  <span className="min-w-[8rem] font-bold">{nameOf(i)}</span>
                  <span className="text-[13px] text-muted">{monthLabel(i.month)} · 납부 기한 {i.due_date?.replace(/-/g, '.') ?? '-'}</span>
                  {failMsg.get(i.id) && <span className="min-w-0 flex-1 truncate text-[12.5px] text-danger">{failMsg.get(i.id)}</span>}
                  <span className="ml-auto font-bold tabular-nums">{won(i.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-7" aria-labelledby="month-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="month-title" className="text-[15px] font-bold">{monthLabel(`${month}-01`)} 청구 현황</h2>
          <nav className="flex items-center gap-1 text-[13px]" aria-label="월 이동">
            <Link href={link(shiftMonth(month, -1))} className="rounded border border-line bg-white px-3 py-1 hover:border-ink">‹ 이전 달</Link>
            <Link href={link(kstToday().slice(0, 7))} className="rounded border border-line bg-white px-3 py-1 hover:border-ink">이번 달</Link>
            <Link href={link(shiftMonth(month, 1))} className="rounded border border-line bg-white px-3 py-1 hover:border-ink">다음 달 ›</Link>
          </nav>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {([['', '전체', rows.length, sum(() => true)], ['paid', '납부 완료', count('paid'), sum((r) => r.k === 'paid')], ['scheduled', '자동 결제 예정', count('scheduled'), sum((r) => r.k === 'scheduled')], ['waiting', '납부 대기', count('waiting'), sum((r) => r.k === 'waiting')], ['failed', '결제 실패', count('failed'), sum((r) => r.k === 'failed')], ['overdue', '기한 지남·제한', count('overdue') + count('hold'), sum((r) => r.k === 'overdue' || r.k === 'hold')]] as [string, string, number, number][]).map(([k, label, n, amount]) => (
            <Link key={k || 'all'} href={link(month, k === 'overdue' ? 'overdue' : k)} className={`rounded-xl bg-white px-4 py-3 ring-1 ${show === k || (!show && k === '') ? 'ring-2 ring-ink' : 'ring-black/5 hover:ring-ink/40'}`}>
              <span className="block text-[12.5px] text-muted">{label}</span>
              <span className="mt-0.5 block text-[20px] font-extrabold tabular-nums">{n}<span className="text-[12px] font-normal text-muted">건</span></span>
              <span className="block text-[12px] tabular-nums text-muted">{won(amount)}</span>
            </Link>
          ))}
        </div>

        <ul className="mt-3 divide-y divide-line rounded-xl bg-white ring-1 ring-black/5">
          {shown.map(({ i, k }) => (
            <li key={i.id}>
              <Link href={`/support/invoices/${i.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-[#F8F9FA] sm:gap-4">
                <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(i)}</span>
                <span className="hidden text-[12.5px] text-muted sm:inline">기한 {i.due_date?.slice(5).replace('-', '.') ?? '-'}</span>
                <span className="w-24 text-right font-bold tabular-nums">{won(i.total)}</span>
                <span className={`w-28 shrink-0 whitespace-nowrap rounded px-2 py-1 text-center text-[12px] font-semibold ${KIND[k].cls}`}>{KIND[k].label}</span>
              </Link>
            </li>
          ))}
          {!shown.length && <li className="py-12 text-center text-muted">{rows.length ? '이 상태의 청구서가 없습니다.' : '이 달에 발행된 청구서가 없습니다.'}</li>}
        </ul>
      </section>
    </div>
  )
}
