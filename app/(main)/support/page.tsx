import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { formatShort } from '@/lib/format'
import { NOTICE_CATEGORIES, TICKET_CATEGORIES, TICKET_STATUS, hasUnreadReply, type NoticeCategory, type TicketCategory, type TicketStatus } from '@/lib/support'

// 첫 화면 아이콘 메뉴 — NDsoft 회원사 페이지처럼 자주 쓰는 일을 한 번에
const TILES = [
  { href: '/support/tickets/new', label: '업무요청', color: '#E5483A', d: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4' },
  { href: '/support/notices', label: '공지', color: '#F5A524', d: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z M15.5 8.5a5 5 0 0 1 0 7 M18.5 5.5a9 9 0 0 1 0 13' },
  { href: '/support/invoices', label: '청구서', color: '#8B5CF6', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Z M9 8h6 M9 12h6', billing: true },
  { href: '/support/billing', label: '결제 정보', color: '#10B981', d: 'M3 6h18v12H3z M3 10h18 M7 15h3', billing: true },
  { href: '/press/email', label: '메일로 받기', color: '#3B82F6', d: 'M3 5h18v14H3z M3.5 6.5l8.5 6 8.5-6' },
  { href: '/support/help', label: '이용안내', color: '#06B6D4', d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14 M12 17h.01' },
  { href: '/account', label: '내 정보', color: '#EC4899', d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0' },
  { href: '/support/help#contact', label: '연락처', color: '#6366F1', d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z' },
]

export default async function SupportHome() {
  const { supabase, isStaff, isEditorPlus } = await getCmsContext()

  const [{ data: tickets }, { data: notices }, { count: openCount }] = await Promise.all([
    supabase.from('support_tickets').select('id, title, status, category, created_at, last_staff_reply_at, requester_read_at, outlet:outlets(name)').order('updated_at', { ascending: false }).limit(8),
    supabase.from('support_notices').select('id, title, category, pinned, created_at').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).neq('status', 'done'),
  ])

  return (
    <div className="mx-auto max-w-[1180px] px-8 py-10">
      <div className="grid grid-cols-4 gap-4 sm:grid-cols-8">
        {TILES.filter((t) => isEditorPlus || !t.billing).map((t) => (
          <Link key={t.label} href={t.href} className="group flex flex-col items-center gap-2.5">
            <span className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-white shadow-[0_6px_18px_-10px_rgba(11,16,32,0.35)] ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_24px_-12px_rgba(11,16,32,0.4)]">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.d} />
              </svg>
            </span>
            <span className="text-[13.5px] font-medium">{t.label}</span>
          </Link>
        ))}
      </div>

      <section className="mt-12">
        <div className="flex items-end justify-between">
          <h2 className="text-[24px] font-extrabold tracking-tight">
            <Link href="/support/tickets" className="hover:underline">{isStaff ? '회원사 업무요청' : '나의 업무요청'} ›</Link>
          </h2>
          <div className="flex items-center gap-4 text-[13.5px]">
            <span className="text-muted">진행 중 <strong className="tabular-nums text-ink">{openCount ?? 0}</strong></span>
            <Link href="/support/tickets/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 font-bold text-white hover:opacity-90">+ 업무요청</Link>
          </div>
        </div>
        {tickets?.length ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tickets.map((t) => {
              const unread = !isStaff && hasUnreadReply(t)
              return (
                <li key={t.id}>
                  <Link href={`/support/tickets/${t.id}`} className="flex h-full min-h-[150px] flex-col rounded-2xl bg-white p-5 shadow-[0_6px_18px_-12px_rgba(11,16,32,0.35)] ring-1 ring-black/5 transition hover:-translate-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11.5px]">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${TICKET_STATUS[t.status as TicketStatus].className}`}>{TICKET_STATUS[t.status as TicketStatus].label}</span>
                      <span className="text-muted">{TICKET_CATEGORIES[t.category as TicketCategory]}</span>
                      {unread && <span className="ml-auto rounded bg-[#E5483A] px-1.5 py-0.5 font-bold text-white">새 답변</span>}
                    </div>
                    <p className="mt-3 line-clamp-3 text-[16px] font-bold leading-snug">{t.title}</p>
                    <p className="mt-auto pt-3 text-[12px] text-muted">
                      {isStaff && (t.outlet as any)?.name ? `${(t.outlet as any).name} · ` : ''}{formatShort(t.created_at)}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-line bg-white px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">아직 업무요청이 없습니다</p>
            <p className="mt-1 text-[13.5px] text-muted">디자인 수정, 기능 문의, 오류 신고 등 필요한 일을 요청하면 운영팀이 답변드립니다.</p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-[20px] font-extrabold tracking-tight"><Link href="/support/notices" className="hover:underline">공지 ›</Link></h2>
        <ul className="mt-4 divide-y divide-line rounded-2xl bg-white ring-1 ring-black/5">
          {(notices ?? []).map((n) => (
            <li key={n.id}>
              <Link href={`/support/notices/${n.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F8F9FA]">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${NOTICE_CATEGORIES[n.category as NoticeCategory].className}`}>{NOTICE_CATEGORIES[n.category as NoticeCategory].label}</span>
                {n.pinned && <span className="text-[12px]" aria-label="고정">📌</span>}
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{n.title}</span>
                <time className="text-[12.5px] tabular-nums text-muted">{formatShort(n.created_at)}</time>
              </Link>
            </li>
          ))}
          {!notices?.length && <li className="px-5 py-8 text-center text-[13.5px] text-muted">공지가 없습니다.</li>}
        </ul>
      </section>
    </div>
  )
}
