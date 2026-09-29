'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell, { OrDivider } from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'

export default function SignupForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해주세요.')
    if (password !== confirm) return setError('비밀번호 확인이 일치하지 않습니다.')

    setLoading(true)
    const { data, error: authError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/pending`,
      },
    })
    setLoading(false)

    if (authError) {
      if (/already registered|already exists/i.test(authError.message)) setError('이미 가입된 이메일입니다. 로그인해 주세요.')
      else if (/rate limit/i.test(authError.message)) setError('가입 요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도하거나 구글 계정으로 가입해 주세요.')
      else if (/password/i.test(authError.message)) setError('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해주세요.')
      else setError(`가입하지 못했습니다: ${authError.message}`)
      return
    }
    // 이메일 인증을 끈 프로젝트는 바로 로그인된다
    if (data.session) {
      router.push('/pending')
      router.refresh()
      return
    }
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthShell subtitle="회원가입" footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인 화면으로</Link>}>
        <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
          <p className="text-[15px] font-semibold">인증 메일을 보냈습니다</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            <strong className="text-ink">{sentTo}</strong> 메일함에서 인증 링크를 눌러주세요.
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <p className="mt-4 rounded bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-muted">인증 후 관리자가 승인하면 기사를 쓸 수 있습니다.</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      subtitle="편집국 회원가입"
      footer={<>이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인</Link></>}
    >
      <GoogleButton label="구글 계정으로 가입" />
      <OrDivider />

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="name" className="field-label">이름 (기사 바이라인에 쓰입니다)</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} className="field-input" placeholder="홍길동" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email" className="field-label">이메일</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">비밀번호 (8자 이상)</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirm" className="field-label">비밀번호 확인</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="field-input" autoComplete="new-password" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? '가입하는 중...' : '가입하기'}
        </button>
        <p className="text-center text-xs leading-relaxed text-muted">가입 후 관리자가 승인하면 기사를 쓸 수 있습니다.</p>
      </form>
    </AuthShell>
  )
}
