import type { Metadata } from 'next'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import GdpaLoginForm from '@/components/gdpa/GdpaLoginForm'

export const metadata: Metadata = { title: '로그인' }

export default function Login() {
  return (
    <div className="mx-auto max-w-[440px] px-4 py-16">
      <div className="text-center">
        <img src="/gdpa/logo-mark.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">로그인</h1>
        <p className="mt-1 text-[14px] text-[var(--g-sub)]">{GDPA.name} 회원 로그인</p>
      </div>
      <div className="mt-8"><GdpaLoginForm base={gdpaBase()} /></div>
    </div>
  )
}
