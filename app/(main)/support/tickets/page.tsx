import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { formatShort } from '@/lib/format'
import { TICKET_CATEGORIES, TICKET_STATUS, hasUnreadReply, type TicketCategory, type TicketStatus } from '@/lib/support'

type Props = { searchParams: Promise<{ tab?: string }> }

export default async function TicketsPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, user, isStaff } = await getCmsContext()
  const tab = ['open', 'unread', 'mine'].includes(searchParams.tab ?? '') ? searchParams.tab : 'all'

  const { data } = await supabase
    .from('support_tickets')
    .select('*, requester:profiles!support_tickets_requester_id_fkey(full_name), outlet:outlets(name)')
    .order('created_at', { ascending: false })
    .limit(300)
  const all = (data ?? []) as any[]
  const open = all.filter((t) => t.status !== 'done')
  // 운영팀: 아직 답하지 않은 요청 / 회원사: 아직 읽지 않은 답변
  const unread = isStaff ? all.filter((t) => t.status === 'received') : all.filter(hasUnreadReply)
  // 운영팀: 내가 담당한 미완료 요청 (배정된 것 + 아직 배정 안 된 내 담당 매체 요청)
  const { data: myOutletRows } = isStaff ? await supabase.from('staff_outlets').select('outlet_id').eq('staff_id', user.id) : { data: [] }
  const myOutlets = new Set(((myOutletRows ?? []) as { outlet_id: string }[]).map((r) => r.outlet_id))
  const mine = all.filter((t) => t.status !== 'done' && (t.assigned_to === user.id || (!t.assigned_to && t.outlet_id && myOutlets.has(t.outlet_id))))
  const rows = tab === 'open' ? open : tab === 'unread' ? unread : tab === 'mine' ? mine : all

  const tabs = [
    { key: 'all', label: '전체', n: null },
    { key: 'open', label: '미완료', n: open.length },
    { key: 'unread', label: isStaff ? '새 요청' : '미확인 답변', n: unread.length },
    ...(isStaff ? [{ key: 'mine', label: '내 담당', n: mine.length }] : []),
  ]

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4">
        <div className="flex items-center gap-1 text-[14.5px]">
          {tabs.map((t, i) => (
            <span key={t.key} className="flex items-center">
              {i > 0 && <span className="mx-3 text-line">|</span>}
              <Link href={t.key === 'all' ? '/support/tickets' : `/support/tickets?tab=${t.key}`} className={tab === t.key ? 'font-bold text-[#2F6BF0]' : 'text-[#3B4048] hover:text-ink'}>
                {t.label}
                {t.n !== null && <span className={`ml-1.5 rounded-full px-1.5 text-[11.5px] tabular-nums text-white ${t.n ? 'bg-[#E5483A]' : 'bg-muted/60'}`}>{t.n}</span>}
              </Link>
            </span>
          ))}
        </div>
        <Link href="/support/tickets/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[14px] font-bold text-white hover:opacity-90">+ 업무요청</Link>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            <th className="w-20 py-3 font-medium">상태</th>
            <th className="py-3 font-medium">제목</th>
            {isStaff && <th className="w-32 py-3 font-medium">매체</th>}
            <th className="w-24 py-3 font-medium">요청인</th>
            <th className="w-28 py-3 text-center font-medium">요청 / 완료</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const s = TICKET_STATUS[t.status as TicketStatus]
            return (
              <tr key={t.id} className="border-b border-line/70 hover:bg-white">
                <td className="py-4"><span className={`rounded px-2 py-1 text-[12px] font-semibold ${s.className}`}>{s.label}</span></td>
                <td className="py-4">
                  <Link href={`/support/tickets/${t.id}`} className="font-medium hover:underline">
                    {t.from_staff
                      ? <span className="mr-1.5 rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-[#2F6BF0]">운영팀 안내</span>
                      : <span className="mr-1.5 text-[12.5px] text-muted">[{TICKET_CATEGORIES[t.category as TicketCategory]}]</span>}
                    {t.title}
                  </Link>
                  {!isStaff && hasUnreadReply(t) && <span className="ml-2 rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">새 답변</span>}
                  {/* AI 첫 답변 상태 (support-ai.sql) */}
                  {t.ai_state === 'answered' && <span className="ml-2 rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">AI 안내함</span>}
                  {t.ai_state === 'resolved' && <span className="ml-2 rounded bg-published/10 px-1.5 py-0.5 text-[11px] font-semibold text-published">AI로 해결</span>}
                  {isStaff && t.ai_state === 'handoff' && <span className="ml-2 rounded bg-[#E5483A]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#E5483A]">담당자 필요</span>}
                  {isStaff && t.ai_urgency === 'high' && t.status !== 'done' && <span className="ml-2 rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">급함</span>}
                </td>
                {isStaff && <td className="py-4 text-[13px] text-muted">{t.outlet?.name ?? '미배정'}</td>}
                <td className="py-4 text-[13px]">{t.requester?.full_name}</td>
                <td className="py-4 text-center text-[12.5px] tabular-nums text-muted">
                  {formatShort(t.created_at)}
                  {t.done_at && <><br />{formatShort(t.done_at)}</>}
                </td>
              </tr>
            )
          })}
          {!rows.length && (
            <tr><td colSpan={isStaff ? 5 : 4} className="py-16 text-center text-muted">해당하는 업무요청이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
