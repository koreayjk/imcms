import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import NoticeForm from '@/components/cms/NoticeForm'

export default async function NewNoticePage() {
  const { profile } = await getCmsContext()
  if (profile?.role !== 'admin') redirect('/support/notices')
  return (
    <div className="mx-auto max-w-[860px] px-8 py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">공지 쓰기</h1>
      <NoticeForm />
    </div>
  )
}
