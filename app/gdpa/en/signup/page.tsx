import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GDPA_EN } from '@/lib/gdpa'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import { gdpaSession } from '@/lib/gdpa-auth'
import GdpaSignupForm from '@/components/gdpa/GdpaSignupForm'

export const metadata: Metadata = { title: 'Sign up' }
export const dynamic = 'force-dynamic'

export default async function Signup() {
  const base = await gdpaBaseEn()
  const { email, member } = await gdpaSession()
  if (member) redirect(`${base}/mypage`)
  return (
    <div className="mx-auto max-w-[760px] px-4 py-14">
      <div className="text-center">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">Sign up</h1>
        <p className="mt-2 text-[15px] text-[var(--g-sub)]">
          {email ? `You are applying for membership of the ${GDPA_EN.name} with ${email}.` : `Welcome to the ${GDPA_EN.name}. After you apply, you can use member services once the Secretariat approves your application.`}
        </p>
      </div>
      <div className="mt-10"><GdpaSignupForm base={base} loggedInEmail={email} lang="en" /></div>
    </div>
  )
}
