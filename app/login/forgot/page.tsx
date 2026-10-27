'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'
import { useCmsLang, useT } from '@/components/cms/CmsLang'

// 비밀번호 찾기: 가입한 이메일로 재설정 링크를 보낸다
//   메일 링크 → /auth/confirm (type=recovery) → /login/reset 에서 새 비밀번호를 정한다 (supabase/email-templates/reset-password.html)
//   가입된 이메일인지 아닌지는 알려 주지 않는다 (남의 가입 여부를 떠보지 못하게)
export default function ForgotPasswordPage() {
  const t = useT()
  const lang = useCmsLang()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  // 메일의 재설정 링크가 만료됐거나 이미 쓰인 경우 (/auth/confirm 에서 돌아옴)
  const [expired, setExpired] = useState(false)
  useEffect(() => { setExpired(new URLSearchParams(window.location.search).get('expired') === '1') }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset`,
    })
    setLoading(false)
    if (authError && /rate|security purposes|seconds/i.test(authError.message)) {
      setError(t('방금 메일을 보냈습니다. 1분쯤 뒤에 다시 시도해 주세요.', 'We just sent an email. Please try again in about a minute.'))
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      subtitle={t('비밀번호 찾기', 'Reset your password')}
      footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인으로 돌아가기', 'Back to sign in')}</Link>}
    >
      {sent ? (
        <div className="space-y-3 text-[14.5px] leading-relaxed">
          <p className="font-semibold">{t('메일을 확인해 주세요.', 'Check your email.')}</p>
          <p className="text-muted">
            {lang === 'en'
              ? <>If an account is registered with <b className="text-ink">{email.trim()}</b>, we have sent a password reset email. Click the button in the email to set a new password. The link is valid for 1 hour, and only the most recent email’s link works.</>
              : <><b className="text-ink">{email.trim()}</b> 로 가입된 계정이 있으면 비밀번호 재설정 메일을 보냈습니다. 메일의 버튼을 눌러 새 비밀번호를 정하세요. 링크는 1시간 동안, 가장 최근에 온 메일 것만 쓸 수 있습니다.</>}
          </p>
          <p className="text-[13px] text-muted">{t('몇 분이 지나도 메일이 없으면 스팸함을 확인해 주세요. 구글 계정으로 가입했다면 비밀번호 없이 로그인 화면의 “구글 계정으로 로그인”을 쓰면 됩니다.', 'If the email has not arrived after a few minutes, check your spam folder. If you signed up with a Google account, you do not need a password: use “Sign in with Google” on the sign-in screen.')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {expired && <p role="alert" className="rounded-md bg-danger/10 px-3 py-2.5 text-[13.5px] leading-relaxed text-danger">{lang === 'en' ? <>The reset link has expired or has already been used. Enter your email to get a new one, then click the button in the <b>most recent email</b> within 1 hour.</> : <>재설정 링크가 만료되었거나 이미 사용되었습니다. 이메일을 넣고 메일을 다시 받아, <b>가장 최근에 온 메일</b>의 버튼을 1시간 안에 눌러 주세요.</>}</p>}
          <p className="text-[14px] leading-relaxed text-muted">{t('가입한 이메일을 넣으면 새 비밀번호를 정하는 링크를 보내 드립니다.', 'Enter the email you signed up with and we will send you a link to set a new password.')}</p>
          <div>
            <label htmlFor="email" className="field-label">{t('이메일', 'Email')}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? t('보내는 중...', 'Sending...') : t('재설정 메일 받기', 'Send reset email')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
