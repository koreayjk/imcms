import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import GdpaResetForm from '@/components/gdpa/GdpaResetForm'

export const metadata: Metadata = { title: 'Reset password' }

export default async function Reset() {
  return (
    <div className="mx-auto max-w-[440px] px-4 py-16">
      <h1 className="text-center text-[24px] font-extrabold text-[var(--g-navy)]">Set a new password</h1>
      <div className="mt-8"><GdpaResetForm base={await gdpaBaseEn()} lang="en" /></div>
    </div>
  )
}
