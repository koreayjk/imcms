import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import NoticeForm from '@/components/cms/NoticeForm'

export default async function NewNoticePage() {
  const { isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) redirect('/support/notices')
  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">{t('공지 쓰기', 'New notice')}</h1>
      <NoticeForm />
    </div>
  )
}
