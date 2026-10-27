import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import OnboardingView from '@/app/(main)/support/onboarding/view'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT()
  return { title: t('개통 현황', 'Launch Status') }
}

export default async function OnboardingDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  return <OnboardingView outletId={id} staff />
}
