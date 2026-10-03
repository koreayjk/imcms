import type { Metadata } from 'next'
import { GDPA } from '@/lib/gdpa'
import { gdpaPrivacySections } from '@/lib/gdpa-policies'
import PolicyBody from '@/components/gdpa/PolicyBody'

export const metadata: Metadata = { title: '개인정보처리방침' }

export default function Page() {
  return (
    <div className="mx-auto max-w-[860px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">개인정보처리방침</h1>
      <p className="mb-10 mt-2 text-[14px] text-[var(--g-sub)]">{GDPA.name} · 시행일 {GDPA.policyDate}</p>
      <PolicyBody sections={gdpaPrivacySections()} />
    </div>
  )
}
