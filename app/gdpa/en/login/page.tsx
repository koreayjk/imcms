import type { Metadata } from 'next'
import { GDPA_EN } from '@/lib/gdpa'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import GdpaLoginForm from '@/components/gdpa/GdpaLoginForm'

export const metadata: Metadata = { title: 'Log in' }

export default async function Login() {
  return (
    <div className="mx-auto max-w-[440px] px-4 py-16">
      <div className="text-center">
        <img src="/gdpa/logo-mark.svg" alt="" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-[26px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">Log in</h1>
        <p className="mt-1 text-[14px] text-[var(--g-sub)]">Member login for the {GDPA_EN.name}</p>
      </div>
      <div className="mt-8"><GdpaLoginForm base={await gdpaBaseEn()} lang="en" /></div>
    </div>
  )
}
