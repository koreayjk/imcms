'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'

// 새 비밀번호 정하기: 비밀번호 찾기 메일의 링크로 들어오면 로그인된 상태다
//   2단계 인증을 켠 사람은 6자리 코드를 먼저 넣고 돌아온다 (/login/mfa)
export default function ResetPasswordPage() {
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'ready' | 'expired'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setState('expired')
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return router.replace('/login/mfa?next=/login/reset')
      setState('ready')
    })()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('비밀번호는 8자 이상으로 정해주세요.')
    if (password !== confirm) return setError('두 칸의 비밀번호가 다릅니다.')
    setLoading(true)
    const { error: authError } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (authError) {
      if (/different from the old|same/i.test(authError.message)) setError('지금 쓰던 비밀번호와 다른 비밀번호로 정해주세요.')
      else if (/weak|password/i.test(authError.message)) setError('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해주세요.')
      else if (/session|expired|jwt/i.test(authError.message)) setState('expired')
      else setError('비밀번호를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
      return
    }
    router.push('/newsroom')
    router.refresh()
  }

  return (
    <AuthShell
      subtitle="새 비밀번호 정하기"
      footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인으로 돌아가기</Link>}
    >
      {state === 'checking' && <p className="text-center text-[14px] text-muted">확인 중...</p>}
      {state === 'expired' && (
        <div className="space-y-3 text-[14.5px] leading-relaxed">
          <p className="font-semibold">링크가 만료되었거나 이미 사용되었습니다.</p>
          <p className="text-muted">재설정 링크는 1시간 동안 한 번만 쓸 수 있습니다. 메일을 다시 받아 주세요.</p>
          <Link href="/login/forgot" className="btn-primary block w-full text-center">재설정 메일 다시 받기</Link>
        </div>
      )}
      {state === 'ready' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="field-label">새 비밀번호 (8자 이상)</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="confirm" className="field-label">새 비밀번호 한 번 더</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '바꾸는 중...' : '비밀번호 바꾸고 편집국으로'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
