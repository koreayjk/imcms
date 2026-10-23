import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import OnboardingView from '@/app/(main)/support/onboarding/view'

export const metadata: Metadata = { title: '개통 현황' }

export default async function OnboardingDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  return <OnboardingView outletId={id} staff />
}
