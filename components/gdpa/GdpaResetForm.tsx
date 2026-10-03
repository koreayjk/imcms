'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// 재설정 메일 링크로 들어온 뒤 새 비밀번호 정하기
export default function GdpaResetForm({ base }: { base: string }) {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (pw.length < 8) { setError('비밀번호는 8자 이상으로 정해 주세요.'); return }
    if (pw !== pw2) { setError('두 비밀번호가 같지 않습니다.'); return }
    setBusy(true)
    const { error } = await createClient().auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setError('비밀번호를 바꾸지 못했습니다. 재설정 메일 링크를 다시 눌러 주세요.'); return }
    router.push(`${base}/mypage`)
  }
  return (
    <form onSubmit={save} className="space-y-4">
      <input type="password" autoComplete="new-password" placeholder="새 비밀번호 (8자 이상)" value={pw} onChange={(e) => setPw(e.target.value)} aria-label="새 비밀번호" className="w-full rounded border border-[var(--g-line)] px-4 py-3" />
      <input type="password" autoComplete="new-password" placeholder="새 비밀번호 확인" value={pw2} onChange={(e) => setPw2(e.target.value)} aria-label="새 비밀번호 확인" className="w-full rounded border border-[var(--g-line)] px-4 py-3" />
      {error && <p role="alert" className="text-[14px] text-[#B3392C]">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded bg-[var(--g-navy)] py-3.5 font-bold text-white disabled:opacity-60">비밀번호 바꾸기</button>
    </form>
  )
}
