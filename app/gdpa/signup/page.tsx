import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import { gdpaSession } from '@/lib/gdpa-auth'
import GdpaSignupForm from '@/components/gdpa/GdpaSignupForm'

export const metadata: Metadata = { title: '회원가입' }
export const dynamic = 'force-dynamic'

export default async function Signup() {
  const base = (await gdpaBase())
  const { email, member } = await gdpaSession()
  if (member) redirect(`${base}/mypage`)
  return (
    <div className="mx-auto max-w-[760px] px-4 py-14">
      <div className="text-center">
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">회원가입</h1>
        <p className="mt-2 text-[15px] text-[var(--g-sub)]">
          {email ? `${email} 계정으로 ${GDPA.name} 회원을 신청합니다.` : `${GDPA.name}에 오신 것을 환영합니다. 가입 신청 후 사무국 승인이 끝나면 회원 서비스를 이용할 수 있습니다.`}
        </p>
      </div>
      <div className="mt-10"><GdpaSignupForm base={base} loggedInEmail={email} /></div>
    </div>
  )
}
