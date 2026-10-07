import Rail from '@/components/cms/Rail'
import { outletHomeUrl } from '@/lib/product'
import TopBar from '@/components/cms/TopBar'
import TrialBar from '@/components/cms/TrialBar'
import { getCmsContext } from '@/lib/cms'
import { hasUnreadReply } from '@/lib/support'
import { GRACE_DAYS, holdFrom, kstToday } from '@/lib/billing'
import { formatDate } from '@/lib/format'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, outletId, isSuper, isStaff, isGroupAdmin, isEditorPlus, trial } = await getCmsContext()

  // 알림 숫자와 매체 목록은 한꺼번에 가져온다 (하나씩 기다리면 그만큼 느려진다)
  // 승인 대기 가입자: 총관리자는 전체, 발행인은 우리 그룹 매체로 신청한 사람 (DB 권한이 보이는 만큼만 센다)
  const pendingQ = isGroupAdmin
    ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('approved', false)
    : Promise.resolve({ count: 0 })
  // 고객센터 알림: 운영팀(총관리자·매니저)은 새 요청 수, 회원사는 읽지 않은 답변 수 (support.sql 전이면 0)
  const ticketQ = isStaff
    ? supabase.from('support_tickets').select('id').eq('status', 'received').limit(99)
    : supabase.from('support_tickets').select('last_staff_reply_at, requester_read_at').eq('requester_id', user.id).not('last_staff_reply_at', 'is', null).limit(99)
  // 운영팀: 아직 연락하지 않은 상담 신청 수
  const leadQ = isStaff
    ? supabase.from('beta_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
    : Promise.resolve({ count: 0 })
  // 발행인·총관리자는 관리하는 매체 사이를 오간다 (DB 권한이 보이는 매체만 돌려준다)
  const outletQuery = (fields: string) => {
    const q = supabase.from('outlets').select(fields).order('created_at')
    return isGroupAdmin || isStaff ? q : q.eq('id', outletId ?? '00000000-0000-0000-0000-000000000000')
  }
  const [{ count: pendingCount }, { data: tickets }, { count: leadCount }, outletRes] = await Promise.all([
    pendingQ, ticketQ, leadQ, outletQuery('id, name, domain, publisher:publishers(name)'),
  ])
  const supportCount = isStaff
    ? (tickets ?? []).length
    : ((tickets ?? []) as { last_staff_reply_at: string | null; requester_read_at: string | null }[]).filter(hasUnreadReply).length
  let { data: outlets } = outletRes
  // groups.sql 실행 전에는 그룹 연결이 없으므로 이름만
  if (outletRes.error) ({ data: outlets } = await outletQuery('id, name, domain'))
  let list = ((outlets ?? []) as any[]).map((o) => ({ id: o.id as string, name: o.name as string, domain: (o.domain as string | null) ?? null, group: (o.publisher?.name as string | undefined) ?? null, role: null as string | null }))
  // 기자·편집장: 소속된 매체들 사이를 오간다 (매체마다 직급이 다를 수 있다, outlet-members.sql 전이면 지금 매체 하나)
  if (!isGroupAdmin && !isStaff) {
    const { data: mine } = await supabase.from('outlet_members').select('role, outlet:outlets(id, name, domain, publisher:publishers(name))').eq('profile_id', user.id).order('created_at')
    const rows = ((mine ?? []) as any[]).filter((m) => m.outlet)
    if (rows.length) {
      list = rows.map((m) => ({ id: m.outlet.id as string, name: m.outlet.name as string, domain: (m.outlet.domain as string | null) ?? null, group: (m.outlet.publisher?.name as string | undefined) ?? null, role: m.role as string }))
    }
  }
  // 매니저: 담당 매체를 맨 위에 (staff-outlets.sql 전이면 그대로)
  if (isStaff && !isSuper) {
    const { data: mine } = await supabase.from('staff_outlets').select('outlet_id').eq('staff_id', user.id)
    const assigned = new Set(((mine ?? []) as { outlet_id: string }[]).map((m) => m.outlet_id))
    list = [...list.filter((o) => assigned.has(o.id)), ...list.filter((o) => !assigned.has(o.id))]
  }
  const current = list.find((o) => o.id === outletId) ?? null

  // 이용료 미납 (billing-dunning.sql): 제한 중이면 빨간 띠, 납부 기한이 지났으면(유예 중) 노란 띠. 운영팀에게는 안 보인다
  let billing: { hold: boolean; overdue: { id: string; month: string; due: string } | null } = { hold: false, overdue: null }
  if (outletId && !isStaff && !trial) {
    const [{ data: o }, { data: inv }] = await Promise.all([
      supabase.from('outlets').select('billing_hold').eq('id', outletId).maybeSingle(),
      isEditorPlus
        ? supabase.from('invoices').select('id, month, due_date').eq('outlet_id', outletId).eq('status', 'unpaid').gt('total', 0).lt('due_date', kstToday()).order('due_date').limit(1)
        : Promise.resolve({ data: [] as { id: string; month: string; due_date: string }[] }),
    ])
    const first = ((inv ?? []) as { id: string; month: string; due_date: string }[])[0]
    billing = { hold: !!(o as { billing_hold?: boolean } | null)?.billing_hold, overdue: first ? { id: first.id, month: first.month, due: first.due_date } : null }
  }
  const monthText = (m: string) => `${Number(m.slice(5, 7))}월`

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F4F5F7] print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="contents print:hidden">
        <Rail userName={profile?.full_name ?? user.email ?? ''} role={profile?.role ?? null} isSuper={isSuper} isStaff={isStaff} isGroupAdmin={isGroupAdmin} pendingCount={pendingCount ?? 0} supportCount={supportCount} leadCount={leadCount ?? 0} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {trial && <TrialBar role={trial.role} daysLeft={trial.daysLeft} />}
        {billing.hold ? (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-danger px-4 py-2 text-[13px] text-white print:hidden">
            <strong>이용료가 밀려 편집국 이용이 제한되었습니다.</strong>
            <span className="opacity-90">기사 쓰기·고치기·발행과 AI 기능을 쓸 수 없습니다. 신문 홈페이지는 그대로 열려 있습니다.</span>
            {isEditorPlus
              ? <a href={billing.overdue ? `/support/invoices/${billing.overdue.id}` : '/support/invoices'} className="ml-auto rounded bg-white px-3 py-1 font-semibold text-danger">결제하면 바로 풀립니다 →</a>
              : <span className="ml-auto opacity-90">발행인·편집장에게 알려 주세요.</span>}
          </div>
        ) : billing.overdue ? (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#FFF4D6] px-4 py-2 text-[13px] text-[#7A4B00] print:hidden">
            <strong>{monthText(billing.overdue.month)} 이용료의 납부 기한({formatDate(billing.overdue.due)})이 지났습니다.</strong>
            <span>{GRACE_DAYS}일 안에 결제하지 않으면 {formatDate(holdFrom(billing.overdue.due))}부터 기사 쓰기·발행이 제한됩니다.</span>
            <a href={`/support/invoices/${billing.overdue.id}`} className="ml-auto rounded bg-[#7A4B00] px-3 py-1 font-semibold text-white">지금 결제하기 →</a>
          </div>
        ) : null}
        <TopBar
          outletName={current?.name ?? null}
          groupName={current?.group ?? null}
          siteUrl={current ? outletHomeUrl({ id: outletId ?? '', domain: current.domain }) : '/'}
          outlets={isGroupAdmin || isStaff || list.length > 1 ? list : []}
          currentOutletId={outletId}
          userName={profile?.full_name ?? user.email ?? ''}
          role={profile?.role ?? null}
          isSuper={isSuper}
          isStaff={isStaff}
        />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 print:overflow-visible print:pb-0">{children}</main>
      </div>
    </div>
  )
}
