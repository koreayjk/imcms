import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import OnboardingView from './view'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t('개통 진행 현황', 'Launch Progress') }
}

// 고객: 우리 매체의 개통 진행 현황. 운영팀은 매체별 목록(/admin/onboarding)으로 간다
export default async function OnboardingProgressPage() {
  const { outletId, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (isStaff) redirect('/admin/onboarding')
  if (!outletId) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8 md:py-10">
        <h1 className="text-[22px] font-extrabold tracking-tight">{t('개통 진행 현황', 'Launch progress')}</h1>
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-[14px] text-muted ring-1 ring-black/5">{t('매체를 먼저 선택해 주세요.', 'Please choose a publication first.')}</p>
      </div>
    )
  }
  return <OnboardingView outletId={outletId} staff={false} />
}
