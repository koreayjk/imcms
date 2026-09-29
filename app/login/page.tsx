'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell, { OrDivider } from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // 구글 로그인·메일 인증이 실패해서 돌아온 경우
  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get('error')
    if (e) setError(e)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password })
    if (authError) {
      setError(/email not confirmed/i.test(authError.message)
        ? '이메일 인증이 아직 안 됐습니다. 가입할 때 받은 메일의 인증 링크를 눌러주세요.'
        : '이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    router.push('/newsroom')
    router.refresh()
  }

  return (
    <AuthShell
      subtitle="언론사 기사 관리 시스템"
      footer={<>계정이 없으신가요? <Link href="/signup" className="font-semibold text-ink underline underline-offset-2">회원가입</Link></>}
    >
      <GoogleButton label="구글 계정으로 로그인" />
      <OrDivider />

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="field-label">이메일</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">비밀번호</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="field-input" placeholder="••••••••" autoComplete="current-password" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </AuthShell>
  )
}
