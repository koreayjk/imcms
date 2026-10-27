import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import NoticeForm from '@/components/cms/NoticeForm'

export default async function EditNoticePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { supabase, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) redirect('/support/notices')
  const { data } = await supabase.from('support_notices').select('*').eq('id', params.id).maybeSingle()
  if (!data) notFound()
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">{t('공지 수정', 'Edit notice')}</h1>
      <NoticeForm notice={data} />
    </div>
  )
}
