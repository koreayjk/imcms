import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import NoticeForm from '@/components/cms/NoticeForm'

export default async function EditNoticePage({ params }: { params: { id: string } }) {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/support/notices')
  const { data } = await supabase.from('support_notices').select('*').eq('id', params.id).maybeSingle()
  if (!data) notFound()
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">공지 수정</h1>
      <NoticeForm notice={data} />
    </div>
  )
}
