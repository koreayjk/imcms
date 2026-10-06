import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import GdpaResetForm from '@/components/gdpa/GdpaResetForm'

export const metadata: Metadata = { title: '비밀번호 재설정' }

export default async function Reset() {
  return (
    <div className="mx-auto max-w-[440px] px-4 py-16">
      <h1 className="text-center text-[24px] font-extrabold text-[var(--g-navy)]">새 비밀번호 정하기</h1>
      <div className="mt-8"><GdpaResetForm base={(await gdpaBase())} /></div>
    </div>
  )
}
