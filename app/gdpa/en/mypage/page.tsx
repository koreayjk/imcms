import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { GDPA } from '@/lib/gdpa'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import { gdpaSession } from '@/lib/gdpa-auth'
import { formatDate } from '@/lib/format'
import GdpaSignupForm from '@/components/gdpa/GdpaSignupForm'

export const metadata: Metadata = { title: 'My account' }
export const dynamic = 'force-dynamic'

const STATUS = {
  pending: { label: 'Pending approval', tone: 'bg-[#9A8C46]/15 text-[#6B5F22]', note: 'The Secretariat is reviewing your application. We will email you once it is approved.' },
  approved: { label: 'Approved', tone: 'bg-[#1E7D4D]/10 text-[#1E7D4D]', note: 'You are a GDPA member. Check Announcements for news and notices of events and training.' },
  rejected: { label: 'On hold', tone: 'bg-[#B3392C]/10 text-[#B3392C]', note: 'Your application has been put on hold. Please contact the Secretariat for details.' },
}

export default async function MyPage() {
  const base = await gdpaBaseEn()
  const { email, member } = await gdpaSession()
  if (!email) redirect(`${base}/login`)
  const fd = (d: string | null) => formatDate(d, 'en')

  return (
    <div className="mx-auto max-w-[760px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">My account</h1>
      {member ? (
        <>
          <div className="mt-6 rounded-lg border border-[var(--g-line)] p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[20px] font-bold">{member.name}</p>
              <span className={`rounded px-2 py-0.5 text-[13px] font-bold ${STATUS[member.status].tone}`}>{STATUS[member.status].label}</span>
              <span className="text-[13px] text-[var(--g-sub)]">{member.member_type === 'outlet' ? 'Member outlet' : 'Individual member'}</span>
            </div>
            <p className="mt-2 text-[14.5px] text-[var(--g-sub)]">{STATUS[member.status].note}</p>
            <dl className="mt-5 grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[130px_1fr]">
              <dt className="text-[var(--g-sub)]">Email</dt><dd>{email}</dd>
              <dt className="text-[var(--g-sub)]">Mobile</dt><dd>{member.phone ?? '-'}</dd>
              <dt className="text-[var(--g-sub)]">Organization</dt><dd>{[member.org, member.position].filter(Boolean).join(' · ') || '-'}</dd>
              <dt className="text-[var(--g-sub)]">Applied on</dt><dd>{fd(member.created_at)}</dd>
              <dt className="text-[var(--g-sub)]">Consents</dt><dd>Terms and privacy {fd(member.agreed_terms_at)} · Event notices {member.marketing ? 'yes' : 'no'}</dd>
            </dl>
          </div>
          <p className="mt-6 text-[14px] leading-[1.75] text-[var(--g-sub)]">
            To change your details or close your account, please contact the Secretariat ({GDPA.office.email || 'see “Contact” for the Secretariat’s details'}). When you leave, we destroy your personal information without delay.{' '}
            <Link href={`${base}/privacy`} className="underline">Privacy Policy</Link>
          </p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px] text-[var(--g-sub)]">The account {email} is not a GDPA member yet. You can apply for membership below.</p>
          <div className="mt-8"><GdpaSignupForm base={base} loggedInEmail={email} lang="en" /></div>
        </>
      )}
    </div>
  )
}
