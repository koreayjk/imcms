import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { NOTICE_CATEGORIES, STAFF_NAME, type NoticeCategory } from '@/lib/support'
import PendingButton from '@/components/cms/PendingButton'
import { deleteNotice } from '../../actions'

export default async function NoticePage({ params }: { params: { id: string } }) {
  const { supabase, isStaff } = await getCmsContext()
  const { data: n } = await supabase.from('support_notices').select('*').eq('id', params.id).maybeSingle()
  if (!n) notFound()
  const c = NOTICE_CATEGORIES[n.category as NoticeCategory]
  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <Link href="/support/notices" className="text-[13px] text-muted hover:text-ink">← 공지 목록</Link>
      <article className="mt-4 rounded-2xl bg-white p-9 ring-1 ring-black/5">
        <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${c.className}`}>{c.label}</span>
        <h1 className="mt-3 text-[26px] font-extrabold leading-snug tracking-tight">{n.title}</h1>
        <p className="mt-2 text-[13px] text-muted">{STAFF_NAME} · {formatDateTime(n.created_at)}</p>
        <div className="mt-7 whitespace-pre-line border-t border-line pt-7 text-[15.5px] leading-[1.9]">{n.body}</div>
      </article>
      {isStaff && (
        <div className="mt-4 flex justify-end gap-2">
          <form action={deleteNotice.bind(null, n.id)}>
            <PendingButton pending="삭제 중…" confirm="이 공지를 삭제할까요?" className="btn-secondary text-danger">삭제</PendingButton>
          </form>
          <Link href={`/support/notices/${n.id}/edit`} className="btn-primary">수정</Link>
        </div>
      )}
    </div>
  )
}
