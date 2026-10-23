import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ONBOARDING_STEPS, stepStates } from '@/lib/onboarding-guide'
import type { LaunchDone } from '@/lib/launch-checklist'

export const metadata: Metadata = { title: '개통 현황' }

type OutletRow = { id: string; name: string; domain: string | null; site: { comingSoon?: boolean } | null; publisher_id: string | null; created_at: string; publisher: { name: string } | null }

// 운영팀: 개설한 고객사의 개통 진행 현황 목록 (진행 중 → 개통 완료). 고객 코멘트가 새로 오면 숫자로 보인다
export default async function OnboardingListPage() {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')

  const [{ data: outletData }, doneRes, commentRes, { data: leads }, { data: staffRows }] = await Promise.all([
    supabase.from('outlets').select('id, name, domain, site, publisher_id, created_at, publisher:publishers(name)').not('publisher_id', 'is', null).order('created_at', { ascending: false }),
    supabase.from('launch_checklists').select('outlet_id, done'),
    supabase.from('launch_comments').select('outlet_id, from_staff, staff_seen, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('beta_requests').select('publisher_id, assigned_to, company').not('publisher_id', 'is', null),
    supabase.from('profiles').select('id, full_name').or('is_super.eq.true,is_staff.eq.true'),
  ])
  const outlets = (outletData ?? []) as unknown as OutletRow[]
  const doneBy = new Map(((doneRes.data ?? []) as { outlet_id: string; done: LaunchDone }[]).map((r) => [r.outlet_id, r.done]))
  const staffName = new Map(((staffRows ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]))
  const managerOf = new Map(((leads ?? []) as { publisher_id: string; assigned_to: string | null }[]).map((l) => [l.publisher_id, l.assigned_to ? staffName.get(l.assigned_to) ?? '' : '']))
  const unseen = new Map<string, number>()
  const last = new Map<string, { at: string; staff: boolean }>()
  for (const c of (commentRes.data ?? []) as { outlet_id: string; from_staff: boolean; staff_seen: boolean; created_at: string }[]) {
    if (!c.from_staff && !c.staff_seen) unseen.set(c.outlet_id, (unseen.get(c.outlet_id) ?? 0) + 1)
    if (!last.has(c.outlet_id)) last.set(c.outlet_id, { at: c.created_at, staff: c.from_staff })
  }
  const progress = (id: string) => {
    const states = stepStates(doneBy.get(id) ?? {}, true)
    return { finished: states.filter((s) => s === 'done').length, total: states.length, doing: ONBOARDING_STEPS[states.findIndex((s) => s === 'doing')]?.title }
  }
  const ongoing = outlets.filter((o) => o.site?.comingSoon === true)
    .sort((a, b) => (unseen.get(b.id) ?? 0) - (unseen.get(a.id) ?? 0))
  const opened = outlets.filter((o) => o.site?.comingSoon !== true)

  const Row = ({ o }: { o: OutletRow }) => {
    const p = progress(o.id)
    const n = unseen.get(o.id) ?? 0
    const l = last.get(o.id)
    return (
      <li>
        <Link href={`/admin/onboarding/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 hover:bg-paper">
          <div className="min-w-[200px] flex-1">
            <p className="flex items-center gap-2 font-semibold">
              {o.name}
              {n > 0 && <span className="rounded-full bg-danger px-2 text-[11.5px] font-bold tabular-nums text-white" aria-label={`새 고객 글 ${n}건`}>새 글 {n}</span>}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">{o.publisher?.name ?? ''}{o.domain ? ` · ${o.domain}` : ''}{managerOf.get(o.publisher_id ?? '') ? ` · 담당 ${managerOf.get(o.publisher_id ?? '')}` : ''}</p>
          </div>
          <div className="w-44">
            <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-[#2F6BF0]" style={{ width: `${Math.round((p.finished / p.total) * 100)}%` }} /></div>
            <p className="mt-1 text-[12px] tabular-nums text-muted">{p.finished}/{p.total}단계{p.doing ? ` · ${p.doing}` : ''}</p>
          </div>
          <p className="w-36 text-right text-[12px] text-muted">{l ? `${l.staff ? '운영팀 답' : '고객 글'} ${formatDateTime(l.at)}` : '코멘트 없음'}</p>
        </Link>
      </li>
    )
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">개통 현황</h1>
        <p className="mt-1 text-[13px] text-muted">고객사 개설 뒤의 모든 절차는 여기서 합니다. 매체를 열어 단계별 체크 항목을 체크하고, 고객이 남긴 코멘트에 답하세요. 고객상담은 신청을 확인하고 완료로 넘기면 끝납니다.</p>
      </header>
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">개통 진행 중 <span className="text-[12.5px] font-normal text-muted">{ongoing.length}곳</span></h2>
        {ongoing.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">{ongoing.map((o) => <Row key={o.id} o={o} />)}</ul>
        ) : (
          <p className="rounded-lg border border-line bg-white px-5 py-10 text-center text-sm text-muted">개통 중인 고객사가 없습니다. 고객상담에서 “고객사 개설”을 하면 여기에 나타납니다.</p>
        )}
      </section>
      {opened.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-[15px] font-bold">개통 완료 <span className="text-[12.5px] font-normal text-muted">{opened.length}곳 · 펼치기</span></summary>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">{opened.map((o) => <Row key={o.id} o={o} />)}</ul>
        </details>
      )}
    </div>
  )
}
