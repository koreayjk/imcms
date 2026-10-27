import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { ticketScope, viewGroupOutletIds } from '@/lib/view-scope'
import { getT } from '@/lib/cms-t'
import { formatShort } from '@/lib/format'
import { TICKET_STATUS, hasUnreadReply, type TicketStatus } from '@/lib/support'
import { ticketCategoryLabel, ticketStatusLabel } from '@/lib/support-i18n'

type Props = { searchParams: Promise<{ tab?: string }> }

export default async function TicketsPage(props: Props) {
  const searchParams = await props.searchParams
  const ctx = await getCmsContext()
  const { supabase, user, isStaff } = ctx
  const { t, lang } = await getT()
  const tab = ['open', 'unread', 'mine'].includes(searchParams.tab ?? '') ? searchParams.tab : 'all'

  // 보기 모드: 그 역할이 실제로 보는 매체의 요청만
  const { data } = await ticketScope(supabase
    .from('support_tickets')
    .select('*, requester:profiles!support_tickets_requester_id_fkey(full_name), outlet:outlets(name)'), ctx, user.id, await viewGroupOutletIds(supabase, ctx))
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
    { key: 'all', label: t('전체', 'All'), n: null },
    { key: 'open', label: t('미완료', 'Open'), n: open.length },
    { key: 'unread', label: isStaff ? t('새 요청', 'New requests') : t('미확인 답변', 'Unread replies'), n: unread.length },
    ...(isStaff ? [{ key: 'mine', label: t('내 담당', 'Assigned to me'), n: mine.length }] : []),
  ]

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap px-1 text-[14.5px]">
          {tabs.map((tb, i) => (
            <span key={tb.key} className="flex items-center">
              {i > 0 && <span className="mx-2 text-line md:mx-3">|</span>}
              <Link href={tb.key === 'all' ? '/support/tickets' : `/support/tickets?tab=${tb.key}`} className={tab === tb.key ? 'font-bold text-[#2F6BF0]' : 'text-[#3B4048] hover:text-ink'}>
                {tb.label}
                {tb.n !== null && <span className={`ml-1.5 rounded-full px-1.5 text-[11.5px] tabular-nums text-white ${tb.n ? 'bg-[#E5483A]' : 'bg-muted/60'}`}>{tb.n}</span>}
              </Link>
            </span>
          ))}
        </div>
        <Link href="/support/tickets/new" className="shrink-0 whitespace-nowrap rounded-full bg-[#2F6BF0] px-4 py-2 text-[14px] font-bold text-white hover:opacity-90 md:px-5">{t('+ 업무요청', '+ New request')}</Link>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full text-[14px] md:min-w-[560px]">
        <thead>
          <tr className="border-b border-line text-left text-[13px] text-muted">
            <th className="w-16 py-3 font-medium md:w-20">{t('상태', 'Status')}</th>
            <th className="py-3 font-medium">{t('제목', 'Title')}</th>
            {isStaff && <th className="hidden w-32 py-3 font-medium md:table-cell">{t('매체', 'Publication')}</th>}
            <th className="hidden w-24 py-3 font-medium md:table-cell">{t('요청인', 'Requester')}</th>
            <th className="hidden w-28 py-3 text-center font-medium md:table-cell">{t('요청 / 완료', 'Requested / Done')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tk) => {
            const s = TICKET_STATUS[tk.status as TicketStatus]
            return (
              <tr key={tk.id} className="border-b border-line/70 hover:bg-white">
                <td className="py-4 align-top md:align-middle"><span className={`whitespace-nowrap rounded px-2 py-1 text-[12px] font-semibold ${s.className}`}>{ticketStatusLabel(tk.status, lang)}</span></td>
                <td className="py-4">
                  <Link href={`/support/tickets/${tk.id}`} className="font-medium hover:underline">
                    {tk.from_staff
                      ? <span className="mr-1.5 rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-[#2F6BF0]">{t('운영팀 안내', 'Team notice')}</span>
                      : <span className="mr-1.5 text-[12.5px] text-muted">[{ticketCategoryLabel(tk.category, lang)}]</span>}
                    {tk.title}
                  </Link>
                  {!isStaff && hasUnreadReply(tk) && <span className="ml-2 rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">{t('새 답변', 'New reply')}</span>}
                  {/* AI 첫 답변 상태 (support-ai.sql) */}
                  {tk.ai_state === 'answered' && <span className="ml-2 rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">{t('AI 안내함', 'AI replied')}</span>}
                  {tk.ai_state === 'resolved' && <span className="ml-2 rounded bg-published/10 px-1.5 py-0.5 text-[11px] font-semibold text-published">{t('AI로 해결', 'Solved by AI')}</span>}
                  {isStaff && tk.ai_state === 'handoff' && <span className="ml-2 rounded bg-[#E5483A]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#E5483A]">{t('담당자 필요', 'Needs an agent')}</span>}
                  {isStaff && tk.ai_urgency === 'high' && tk.status !== 'done' && <span className="ml-2 rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">{t('급함', 'Urgent')}</span>}
                  {/* 휴대폰: 매체·요청인·날짜를 제목 아래 한 줄로 */}
                  <p className="mt-1 text-[12px] text-muted md:hidden">
                    {[isStaff ? (tk.from_staff ? t('개별 안내', 'Direct message') : tk.outlet?.name ?? t('미배정', 'Unassigned')) : null, tk.from_staff ? `→ ${tk.requester?.full_name ?? ''} ${t('(받는 분)', '(recipient)')}` : tk.requester?.full_name, formatShort(tk.created_at, lang), tk.done_at ? `${t('완료', 'Done')} ${formatShort(tk.done_at, lang)}` : null].filter(Boolean).join(' · ')}
                  </p>
                </td>
                {isStaff && <td className="hidden py-4 text-[13px] text-muted md:table-cell">{tk.from_staff ? t('개별 안내', 'Direct message') : tk.outlet?.name ?? t('미배정', 'Unassigned')}</td>}
                <td className="hidden py-4 text-[13px] md:table-cell">{tk.from_staff ? <span title={t('운영팀이 보낸 안내를 받는 분', 'Recipient of a message from the IM Newsroom team')}>→ {tk.requester?.full_name} <span className="text-[11.5px] text-muted">{t('(받는 분)', '(recipient)')}</span></span> : tk.requester?.full_name}</td>
                <td className="hidden py-4 text-center text-[12.5px] tabular-nums text-muted md:table-cell">
                  {formatShort(tk.created_at, lang)}
                  {tk.done_at && <><br />{formatShort(tk.done_at, lang)}</>}
                </td>
              </tr>
            )
          })}
          {!rows.length && (
            <tr><td colSpan={isStaff ? 5 : 4} className="py-16 text-center text-muted">{t('해당하는 업무요청이 없습니다.', 'No matching support requests.')}</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
