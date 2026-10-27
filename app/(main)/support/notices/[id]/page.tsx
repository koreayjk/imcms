import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import { NOTICE_CATEGORIES, type NoticeCategory } from '@/lib/support'
import { noticeCategoryLabel, staffName } from '@/lib/support-i18n'
import PendingButton from '@/components/cms/PendingButton'
import { deleteNotice } from '../../actions'
import BackLink from '@/components/cms/BackLink'

export default async function NoticePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { supabase, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  const { data: n } = await supabase.from('support_notices').select('*').eq('id', params.id).maybeSingle()
  if (!n) notFound()
  const c = NOTICE_CATEGORIES[n.category as NoticeCategory]
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <BackLink href="/support/notices" className="text-[13px] text-muted hover:text-ink">{t('← 공지 목록', '← Notices')}</BackLink>
      <article className="mt-4 rounded-2xl bg-white p-5 ring-1 sm:p-9 ring-black/5">
        <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${c.className}`}>{noticeCategoryLabel(n.category, lang)}</span>
        <h1 className="mt-3 text-[26px] font-extrabold leading-snug tracking-tight">{n.title}</h1>
        <p className="mt-2 text-[13px] text-muted">{staffName(lang)} · {formatDateTime(n.created_at, lang)}</p>
        <div className="mt-7 whitespace-pre-line break-words border-t border-line pt-7 text-[15.5px] leading-[1.9]">{n.body}</div>
      </article>
      {isStaff && (
        <div className="mt-4 flex justify-end gap-2">
          <form action={deleteNotice.bind(null, n.id)}>
            <PendingButton pending={t('삭제 중…', 'Deleting…')} confirm={t('이 공지를 삭제할까요?', 'Delete this notice?')} className="btn-secondary text-danger">{t('삭제', 'Delete')}</PendingButton>
          </form>
          <Link href={`/support/notices/${n.id}/edit`} className="btn-primary">{t('수정', 'Edit')}</Link>
        </div>
      )}
    </div>
  )
}
