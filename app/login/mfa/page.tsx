'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import { MFA_DAYS, MFA_DAYS_STAFF } from '@/lib/mfa'

type Factor = { id: string; friendly_name?: string | null; created_at: string }

// 다른 사이트로 넘어가지 않게 우리 화면 주소만 받는다
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login') ? raw : '/newsroom'
}

// 로그인 뒤 2단계 인증: 인증 앱의 6자리 코드
export default function MfaPage() {
  const router = useRouter()
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [again, setAgain] = useState(false)
  const next = useRef('/newsroom')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    next.current = safeNext(params.get('next'))
    const isAgain = params.get('again') === '1'
    setAgain(isAgain)
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      const { data } = await supabase.auth.mfa.listFactors()
      const list = ((data?.totp ?? []) as Factor[]).filter((f) => (f as { status?: string }).status !== 'unverified')
      // 인증 앱이 없으면 코드가 필요 없다
      if (!list.length) return router.replace(next.current)
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal2' && !isAgain) return router.replace(next.current)
      setFactors(list)
      setFactorId(list[0].id)
      setTimeout(() => input.current?.focus(), 0)
    })()
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) return setError('인증 앱에 보이는 6자리 숫자를 넣어 주세요.')
    setBusy(true)
    setError('')
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: digits })
    if (err) {
      setBusy(false)
      setCode('')
      input.current?.focus()
      return setError(/invalid|expired/i.test(err.message)
        ? '코드가 맞지 않습니다. 앱에 지금 보이는 숫자를 넣어 주세요. (숫자는 30초마다 바뀝니다)'
        : /rate|too many/i.test(err.message) ? '시도가 너무 많습니다. 잠시 뒤 다시 해 주세요.' : `확인하지 못했습니다: ${err.message}`)
    }
    router.replace(next.current)
    router.refresh()
  }

  return (
    <AuthShell subtitle="2단계 인증">
      <div className="rounded-lg border border-line bg-white px-6 py-7">
        <p className="text-[15px] font-semibold">{again ? '보안을 위해 코드를 한 번 더 확인합니다' : '인증 앱의 6자리 코드를 넣어 주세요'}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          휴대폰의 인증 앱(Google Authenticator 등)에서 <strong className="text-ink">IM Newsroom</strong> 항목의 숫자를 넣으세요.
          이 기기에서 로그아웃하지 않으면 {MFA_DAYS}일(총관리자·매니저는 {MFA_DAYS_STAFF}일) 동안 다시 묻지 않습니다.
        </p>
        {factors === null ? (
          <p className="mt-6 text-center text-[13px] text-muted">확인하는 중…</p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {factors.length > 1 && (
              <div>
                <label htmlFor="factor" className="field-label">인증 앱</label>
                <select id="factor" value={factorId} onChange={(e) => setFactorId(e.target.value)} className="field-input">
                  {factors.map((f) => <option key={f.id} value={f.id}>{f.friendly_name || '인증 앱'}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="code" className="field-label">6자리 코드</label>
              <input
                id="code" ref={input} value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
                inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" placeholder="123456"
                className="field-input text-center text-[22px] font-semibold tracking-[0.35em] tabular-nums"
              />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? '확인 중…' : '확인'}</button>
          </form>
        )}
        <p className="mt-5 border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
          휴대폰을 바꿨거나 잃어버렸다면 우리 언론사 발행인(또는 IM 뉴스룸 고객센터 contact@imnewsroom.com)에게 <strong className="text-ink">2단계 인증 초기화</strong>를 요청하세요. 초기화한 뒤 로그인하면 인증 앱을 새로 등록합니다.
        </p>
        <div className="mt-4 flex justify-center"><SignOutButton /></div>
      </div>
    </AuthShell>
  )
}
