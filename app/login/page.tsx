'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell, { OrDivider } from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'
import { IOS_ORG_ONLY_NOTICE } from '@/lib/ios-app'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 메일 인증이 안 된 계정: 인증 메일 다시 보내기
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState('')
  const router = useRouter()

  // 구글 로그인·메일 인증이 실패해서 돌아온 경우
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const e = q.get('error')
    if (e) setError(e)
    // 내 정보에서 계정을 지운 뒤
    if (q.get('deleted') === '1') setResent('계정을 삭제했습니다. 그동안 IM 뉴스룸을 이용해 주셔서 감사합니다.')
    // 인증 링크가 만료된 경우: 이메일을 적고 인증 메일을 다시 받을 수 있게
    if (e && /인증 링크|만료/.test(e)) setUnconfirmed(true)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setResent('')
    setLoading(true)
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password })
    if (authError) {
      const notConfirmed = /email not confirmed/i.test(authError.message)
      setUnconfirmed(notConfirmed)
      setError(notConfirmed
        ? '이메일 인증이 아직 안 됐습니다. 아래 “인증 메일 다시 받기”를 누르고, 새로 온 메일의 링크를 1시간 안에 눌러 주세요.'
        : '이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    router.push('/newsroom')
    router.refresh()
  }

  async function resend() {
    if (!email.trim()) { setError('인증 메일을 받을 이메일을 위 칸에 적어 주세요.'); return }
    setLoading(true)
    const { error: err } = await createClient().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/newsroom` } })
    setLoading(false)
    if (err) {
      setResent('')
      setError(/rate limit|seconds|security purposes/i.test(err.message) ? '조금 전에 보냈습니다. 1분쯤 뒤 다시 눌러 주세요.' : '인증 메일을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
      return
    }
    setError('')
    setResent(`${email.trim()} 으로 인증 메일을 다시 보냈습니다. 메일함(안 보이면 스팸함)에서 가장 최근 메일의 링크를 1시간 안에 눌러 주세요. 예전 메일의 링크는 쓸 수 없습니다.`)
  }

  return (
    <AuthShell
      subtitle="언론사 기사 관리 시스템"
      footer={<>
        <span className="ios-app-hide">계정이 없으신가요? <Link href="/signup" className="font-semibold text-ink underline underline-offset-2">회원가입</Link></span>
        <span className="ios-app-only">{IOS_ORG_ONLY_NOTICE}</span>
      </>}
    >
      <GoogleButton label="구글 계정으로 로그인" />
      <OrDivider />

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label htmlFor="email" className="field-label">이메일</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="field-label">비밀번호</label>
            <Link href="/login/forgot" className="text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline">비밀번호 찾기</Link>
          </div>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="field-input" placeholder="••••••••" autoComplete="current-password" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {resent && <p role="status" className="text-sm text-ink">{resent}</p>}
        {unconfirmed && (
          <button type="button" onClick={resend} disabled={loading} className="w-full rounded-md border border-line py-2.5 text-[14px] font-semibold text-ink hover:bg-black/5 disabled:opacity-60">
            인증 메일 다시 받기
          </button>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </AuthShell>
  )
}
