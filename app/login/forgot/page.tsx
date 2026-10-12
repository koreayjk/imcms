'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'

// 비밀번호 찾기: 가입한 이메일로 재설정 링크를 보낸다
//   메일 링크 → /auth/confirm (type=recovery) → /login/reset 에서 새 비밀번호를 정한다 (supabase/email-templates/reset-password.html)
//   가입된 이메일인지 아닌지는 알려 주지 않는다 (남의 가입 여부를 떠보지 못하게)
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/login/reset`,
    })
    setLoading(false)
    if (authError && /rate|security purposes|seconds/i.test(authError.message)) {
      setError('방금 메일을 보냈습니다. 1분쯤 뒤에 다시 시도해 주세요.')
      return
    }
    setSent(true)
  }

  return (
    <AuthShell
      subtitle="비밀번호 찾기"
      footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인으로 돌아가기</Link>}
    >
      {sent ? (
        <div className="space-y-3 text-[14.5px] leading-relaxed">
          <p className="font-semibold">메일을 확인해 주세요.</p>
          <p className="text-muted">
            <b className="text-ink">{email.trim()}</b> 로 가입된 계정이 있으면 비밀번호 재설정 메일을 보냈습니다. 메일의 버튼을 눌러 새 비밀번호를 정하세요. 링크는 1시간 동안만 쓸 수 있습니다.
          </p>
          <p className="text-[13px] text-muted">몇 분이 지나도 메일이 없으면 스팸함을 확인해 주세요. 구글 계정으로 가입했다면 비밀번호 없이 로그인 화면의 “구글 계정으로 로그인”을 쓰면 됩니다.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-[14px] leading-relaxed text-muted">가입한 이메일을 넣으면 새 비밀번호를 정하는 링크를 보내 드립니다.</p>
          <div>
            <label htmlFor="email" className="field-label">이메일</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '보내는 중...' : '재설정 메일 받기'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
