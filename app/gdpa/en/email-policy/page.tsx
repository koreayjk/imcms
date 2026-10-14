import type { Metadata } from 'next'
import { GDPA, GDPA_EN } from '@/lib/gdpa'

export const metadata: Metadata = { title: 'No Email Harvesting' }

export default function Page() {
  const posted = new Date(`${GDPA.policyDate}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <div className="mx-auto max-w-[860px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">No Email Harvesting</h1>
      <p className="mt-8 text-[16px] leading-[1.85]">We do not allow email addresses posted on this website to be collected without permission by email-harvesting programs or any other technical means. Anyone who does so may be punished under Korea’s Act on Promotion of Information and Communications Network Utilization and Information Protection.</p>
      <p className="mt-4 text-[14px] text-[var(--g-sub)]">{GDPA_EN.name} · Posted {posted}</p>
    </div>
  )
}
