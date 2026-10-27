'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'
import { useT } from '@/components/cms/CmsLang'

// 새 비밀번호 정하기: 비밀번호 찾기 메일의 링크로 들어오면 로그인된 상태다
//   2단계 인증을 켠 사람은 6자리 코드를 먼저 넣고 돌아온다 (/login/mfa)
export default function ResetPasswordPage() {
  const t = useT()
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
    if (password.length < 8) return setError(t('비밀번호는 8자 이상으로 정해주세요.', 'Your password must be at least 8 characters.'))
    if (password !== confirm) return setError(t('두 칸의 비밀번호가 다릅니다.', 'The two passwords do not match.'))
    setLoading(true)
    const { error: authError } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (authError) {
      if (/different from the old|same/i.test(authError.message)) setError(t('지금 쓰던 비밀번호와 다른 비밀번호로 정해주세요.', 'Choose a password different from your current one.'))
      else if (/weak|password/i.test(authError.message)) setError(t('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해주세요.', 'That password is too easy to guess. Use at least 8 characters, mixing letters and numbers.'))
      else if (/session|expired|jwt/i.test(authError.message)) setState('expired')
      else setError(t('비밀번호를 바꾸지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not change your password. Please try again shortly.'))
      return
    }
    router.push('/newsroom')
    router.refresh()
  }

  return (
    <AuthShell
      subtitle={t('새 비밀번호 정하기', 'Set a new password')}
      footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인으로 돌아가기', 'Back to sign in')}</Link>}
    >
      {state === 'checking' && <p className="text-center text-[14px] text-muted">{t('확인 중...', 'Checking...')}</p>}
      {state === 'expired' && (
        <div className="space-y-3 text-[14.5px] leading-relaxed">
          <p className="font-semibold">{t('링크가 만료되었거나 이미 사용되었습니다.', 'This link has expired or has already been used.')}</p>
          <p className="text-muted">{t('재설정 링크는 1시간 동안 한 번만 쓸 수 있습니다. 메일을 다시 받아 주세요.', 'A reset link works once and is valid for 1 hour. Please request a new email.')}</p>
          <Link href="/login/forgot" className="btn-primary block w-full text-center">{t('재설정 메일 다시 받기', 'Send reset email again')}</Link>
        </div>
      )}
      {state === 'ready' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="field-label">{t('새 비밀번호 (8자 이상)', 'New password (at least 8 characters)')}</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
          </div>
          <div>
            <label htmlFor="confirm" className="field-label">{t('새 비밀번호 한 번 더', 'Confirm new password')}</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('바꾸는 중...', 'Changing...') : t('비밀번호 바꾸고 편집국으로', 'Change password and go to the newsroom')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
