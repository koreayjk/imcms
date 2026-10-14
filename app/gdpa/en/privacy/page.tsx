import type { Metadata } from 'next'
import { GDPA, GDPA_EN } from '@/lib/gdpa'
import { gdpaPrivacySectionsEn } from '@/lib/gdpa-policies-en'
import PolicyBody from '@/components/gdpa/PolicyBody'

export const metadata: Metadata = { title: 'Privacy Policy' }

const effective = () => new Date(`${GDPA.policyDate}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })

export default function Page() {
  return (
    <div className="mx-auto max-w-[860px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">Privacy Policy</h1>
      <p className="mb-10 mt-2 text-[14px] text-[var(--g-sub)]">{GDPA_EN.name} · Effective {effective()}</p>
      <PolicyBody sections={gdpaPrivacySectionsEn()} lang="en" />
    </div>
  )
}
