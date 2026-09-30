import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { formatShort } from '@/lib/format'
import { NOTICE_CATEGORIES, type NoticeCategory } from '@/lib/support'

export default async function NoticesPage() {
  const { supabase, isSuper } = await getCmsContext()
  const { data } = await supabase.from('support_notices').select('id, title, category, pinned, created_at')
    .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(200)
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight">공지</h1>
        {isSuper && <Link href="/support/notices/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[14px] font-bold text-white hover:opacity-90">+ 공지 쓰기</Link>}
      </div>
      <ul className="divide-y divide-line">
        {(data ?? []).map((n) => {
          const c = NOTICE_CATEGORIES[n.category as NoticeCategory]
          return (
            <li key={n.id}>
              <Link href={`/support/notices/${n.id}`} className={`flex items-center gap-3 px-2 py-4 hover:bg-white ${n.pinned ? 'bg-[#FFF8E6]' : ''}`}>
                <span className={`w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[11.5px] font-semibold ${c.className}`}>{c.label}</span>
                {n.pinned && <span aria-label="고정">📌</span>}
                <span className="min-w-0 flex-1 truncate text-[15px]">{n.title}</span>
                <time className="text-[12.5px] tabular-nums text-muted">{formatShort(n.created_at)}</time>
              </Link>
            </li>
          )
        })}
        {!data?.length && <li className="py-16 text-center text-muted">공지가 없습니다.</li>}
      </ul>
    </div>
  )
}
