import Rail from '@/components/cms/Rail'
import TopBar from '@/components/cms/TopBar'
import { getCmsContext } from '@/lib/cms'
import { hasUnreadReply } from '@/lib/support'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile, outletId, isSuper, isStaff, isGroupAdmin } = await getCmsContext()

  // 알림 숫자와 매체 목록은 한꺼번에 가져온다 (하나씩 기다리면 그만큼 느려진다)
  // 승인 대기 가입자는 어느 그룹인지 모르므로 총관리자에게만 알린다
  const pendingQ = isSuper
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
    return isGroupAdmin ? q : q.eq('id', outletId ?? '00000000-0000-0000-0000-000000000000')
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
  const list = ((outlets ?? []) as any[]).map((o) => ({ id: o.id as string, name: o.name as string, domain: (o.domain as string | null) ?? null, group: (o.publisher?.name as string | undefined) ?? null }))
  const current = list.find((o) => o.id === outletId) ?? null

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F4F5F7] print:block print:h-auto print:overflow-visible print:bg-white">
      <div className="contents print:hidden">
        <Rail userName={profile?.full_name ?? user.email ?? ''} role={profile?.role ?? null} isSuper={isSuper} isStaff={isStaff} isGroupAdmin={isGroupAdmin} pendingCount={pendingCount ?? 0} supportCount={supportCount} leadCount={leadCount ?? 0} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          outletName={current?.name ?? null}
          groupName={current?.group ?? null}
          siteUrl={current?.domain ? `https://${current.domain}` : '/'}
          outlets={isGroupAdmin ? list : []}
          currentOutletId={outletId}
          userName={profile?.full_name ?? user.email ?? ''}
          role={profile?.role ?? null}
          isSuper={isSuper}
          isStaff={isStaff}
        />
        <main className="flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 print:overflow-visible print:pb-0">{children}</main>
      </div>
    </div>
  )
}
