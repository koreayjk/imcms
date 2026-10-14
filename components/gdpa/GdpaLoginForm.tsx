'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function GdpaLoginForm({ base, lang = 'ko' }: { base: string; lang?: 'ko' | 'en' }) {
  const en = lang === 'en'
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [busy, setBusy] = useState(false)

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg({})
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) {
      setMsg({ error: /confirm/i.test(error.message) ? (en ? 'Please click the link in your confirmation email first.' : '가입 확인 메일의 링크를 먼저 눌러 주세요.') : (en ? 'The email or password is incorrect.' : '이메일 또는 비밀번호가 맞지 않습니다.') })
      return
    }
    router.push(`${base}/mypage`)
    router.refresh()
  }

  async function reset() {
    if (!email.trim()) { setMsg({ error: en ? 'Enter your email address first, then request a password reset.' : '비밀번호를 재설정할 이메일을 먼저 적어 주세요.' }); return }
    setBusy(true); setMsg({})
    const next = encodeURIComponent(`${base}/reset`)
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/auth/callback?next=${next}` })
    setBusy(false)
    setMsg(error ? { error: en ? 'We could not send the email. Please try again shortly.' : '메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.' } : { ok: en ? 'We sent you a password reset email. Click the link in it to set a new password.' : '비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.' })
  }

  return (
    <form onSubmit={login} className="space-y-4">
      <div>
        <label htmlFor="g-email" className="mb-1.5 block text-[14px] font-semibold">{en ? 'Email' : '이메일'}</label>
        <input id="g-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-[var(--g-line)] px-4 py-3 text-[15px] outline-none focus:border-[var(--g-navy)]" />
      </div>
      <div>
        <label htmlFor="g-pw" className="mb-1.5 block text-[14px] font-semibold">{en ? 'Password' : '비밀번호'}</label>
        <input id="g-pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-[var(--g-line)] px-4 py-3 text-[15px] outline-none focus:border-[var(--g-navy)]" />
      </div>
      {msg.error && <p role="alert" className="text-[14px] text-[#B3392C]">{msg.error}</p>}
      {msg.ok && <p role="status" className="text-[14px] text-[#1E7D4D]">{msg.ok}</p>}
      <button type="submit" disabled={busy} className="w-full rounded bg-[var(--g-navy)] py-3.5 text-[16px] font-bold text-white disabled:opacity-60">{busy ? (en ? 'Checking…' : '확인 중…') : (en ? 'Log in' : '로그인')}</button>
      <div className="flex justify-between text-[14px] text-[var(--g-sub)]">
        <button type="button" onClick={reset} disabled={busy} className="underline underline-offset-2">{en ? 'Reset password' : '비밀번호 재설정'}</button>
        <a href={`${base}/signup`} className="font-semibold text-[var(--g-navy)]">{en ? 'Sign up →' : '회원가입 →'}</a>
      </div>
    </form>
  )
}
