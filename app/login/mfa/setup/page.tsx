'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import { MFA_DAYS, MFA_DAYS_STAFF } from '@/lib/mfa'

type Enrolled = { id: string; qr: string; secret: string }

// Supabase가 주는 QR(SVG 글자 그대로 넣은 data 주소)을 어느 브라우저에서도 보이게 바꾼다
function svgSrc(qr: string) {
  const m = qr.match(/^data:image\/svg\+xml;[^,]*,([\s\S]*)$/)
  if (!m || !m[1].trimStart().startsWith('<')) return qr
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(m[1])}`
}

function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login') ? raw : '/account'
}

// 인증 앱 등록: QR 코드를 찍고 6자리 코드로 확인하면 2단계 인증이 켜진다
export default function MfaSetupPage() {
  const router = useRouter()
  const [required, setRequired] = useState(false)
  const [enrolled, setEnrolled] = useState<Enrolled | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const next = useRef('/account')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const params = new URLSearchParams(window.location.search)
    setRequired(params.get('required') === '1')
    next.current = safeNext(params.get('next') ?? (params.get('required') === '1' ? '/newsroom' : null))
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.replace('/login')
      const { data: list } = await supabase.auth.mfa.listFactors()
      // 이미 인증 앱이 있으면 코드부터 넣어야 하나 더 등록할 수 있다
      if ((list?.totp ?? []).length) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel !== 'aal2') return router.replace(`/login/mfa?next=${encodeURIComponent('/login/mfa/setup')}`)
      }
      // 등록하다 그만둔 것은 지우고 새로
      for (const f of (list?.all ?? []).filter((f) => f.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
      const stamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `인증 앱 ${stamp}`, issuer: 'IM Newsroom' })
      if (err || !data) return setError(`인증 앱을 준비하지 못했습니다: ${err?.message ?? '알 수 없는 오류'}`)
      setEnrolled({ id: data.id, qr: svgSrc(data.totp.qr_code), secret: data.totp.secret })
    })()
  }, [router])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrolled) return
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) return setError('인증 앱에 보이는 6자리 숫자를 넣어 주세요.')
    setBusy(true)
    setError('')
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: digits })
    setBusy(false)
    if (err) {
      setCode('')
      return setError(/invalid|expired/i.test(err.message) ? '코드가 맞지 않습니다. 앱에 지금 보이는 숫자를 넣어 주세요.' : `확인하지 못했습니다: ${err.message}`)
    }
    setDone(true)
  }

  async function cancel() {
    if (enrolled) await createClient().auth.mfa.unenroll({ factorId: enrolled.id })
    router.replace('/account')
  }

  const secret = enrolled?.secret.replace(/(.{4})/g, '$1 ').trim() ?? ''

  return (
    <AuthShell subtitle="2단계 인증 켜기">
      <div className="rounded-lg border border-line bg-white px-6 py-7">
        {required && !done && (
          <p className="mb-5 rounded-md bg-[#EEF3F9] px-3.5 py-3 text-[13px] leading-relaxed text-[#1F3A5F]">
            이 계정은 2단계 인증을 켜야 편집국을 쓸 수 있습니다. (총관리자·매니저, 또는 발행인이 필수로 정한 언론사의 발행인·편집장)
          </p>
        )}
        {done ? (
          <div className="text-center">
            <p className="text-[15px] font-semibold">2단계 인증을 켰습니다</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              앞으로 새 기기에서 로그인하면 인증 앱의 6자리 코드를 넣습니다. 같은 기기에서는 로그아웃하지 않으면 {MFA_DAYS}일(총관리자·매니저는 {MFA_DAYS_STAFF}일) 동안 묻지 않습니다.
            </p>
            <p className="mt-3 rounded-md bg-paper px-3 py-2.5 text-left text-[12.5px] leading-relaxed text-muted">
              휴대폰을 잃어버릴 때를 대비해, 내 정보에서 다른 기기(태블릿 등)의 인증 앱을 하나 더 등록해 두면 좋습니다.
            </p>
            <button type="button" onClick={() => { router.replace(next.current); router.refresh() }} className="btn-primary mt-5 w-full">계속</button>
          </div>
        ) : (
          <>
            <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
              <li><strong>1.</strong> 휴대폰에 인증 앱을 설치합니다 (Google Authenticator, Microsoft Authenticator 등).</li>
              <li><strong>2.</strong> 앱에서 “QR 코드 스캔”으로 아래 그림을 찍습니다.</li>
              <li><strong>3.</strong> 앱에 생긴 <strong>IM Newsroom</strong> 항목의 6자리 숫자를 넣습니다.</li>
            </ol>
            <div className="mt-5 grid place-items-center rounded-lg border border-line bg-white p-4">
              {enrolled
                ? <img src={enrolled.qr} alt="인증 앱으로 찍을 QR 코드" width={184} height={184} className="h-[184px] w-[184px]" />
                : <div className="grid h-[184px] w-[184px] place-items-center text-[13px] text-muted">{error ? '준비 실패' : '준비하는 중…'}</div>}
            </div>
            {enrolled && (
              <div className="mt-2 text-center">
                {showKey
                  ? <p className="break-all font-mono text-[13px] tracking-wide">{secret}</p>
                  : <button type="button" onClick={() => setShowKey(true)} className="text-[12.5px] text-muted underline underline-offset-2">QR을 찍을 수 없나요? 키 직접 입력</button>}
              </div>
            )}
            <form onSubmit={verify} className="mt-5 space-y-4">
              <div>
                <label htmlFor="code" className="field-label">6자리 코드</label>
                <input
                  id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
                  inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" placeholder="123456" disabled={!enrolled}
                  className="field-input text-center text-[22px] font-semibold tracking-[0.35em] tabular-nums"
                />
              </div>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={busy || !enrolled} className="btn-primary w-full">{busy ? '확인 중…' : '확인하고 켜기'}</button>
            </form>
            <div className="mt-4 flex justify-center gap-2">
              {required ? <SignOutButton /> : <button type="button" onClick={cancel} className="btn-secondary">취소</button>}
            </div>
          </>
        )}
      </div>
    </AuthShell>
  )
}
