'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { syncSessionAndGo } from '@/lib/session-sync'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import { MFA_DAYS, MFA_DAYS_STAFF } from '@/lib/mfa'
import { useCmsLang, useT } from '@/components/cms/CmsLang'

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
  const t = useT()
  const lang = useCmsLang()
  const en = lang === 'en'
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
      const stamp = new Date().toLocaleString(en ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `${t('인증 앱', 'Authenticator app')} ${stamp}`, issuer: 'IM Newsroom' })
      if (err || !data) return setError(`${t('인증 앱을 준비하지 못했습니다', 'Could not set up the authenticator app')}: ${err?.message ?? t('알 수 없는 오류', 'Unknown error')}`)
      setEnrolled({ id: data.id, qr: svgSrc(data.totp.qr_code), secret: data.totp.secret })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!enrolled) return
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) return setError(t('인증 앱에 보이는 6자리 숫자를 넣어 주세요.', 'Enter the 6-digit number shown in your authenticator app.'))
    setBusy(true)
    setError('')
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: digits })
    setBusy(false)
    if (err) {
      setCode('')
      return setError(/invalid|expired/i.test(err.message) ? t('코드가 맞지 않습니다. 앱에 지금 보이는 숫자를 넣어 주세요.', 'That code is incorrect. Enter the number currently shown in the app.') : `${t('확인하지 못했습니다', 'Could not verify')}: ${err.message}`)
    }
    setDone(true)
  }

  async function cancel() {
    if (enrolled) await createClient().auth.mfa.unenroll({ factorId: enrolled.id })
    router.replace('/account')
  }

  const secret = enrolled?.secret.replace(/(.{4})/g, '$1 ').trim() ?? ''

  return (
    <AuthShell subtitle={t('2단계 인증 켜기', 'Turn on two-step verification')}>
      <div className="rounded-lg border border-line bg-white px-6 py-7">
        {required && !done && (
          <p className="mb-5 rounded-md bg-[#EEF3F9] px-3.5 py-3 text-[13px] leading-relaxed text-[#1F3A5F]">
            {t('이 계정은 2단계 인증을 켜야 편집국을 쓸 수 있습니다. (총관리자·매니저, 또는 발행인이 필수로 정한 언론사의 발행인·편집장)', 'This account must turn on two-step verification to use the newsroom. (Super Admins and Managers, or the Publisher and Editors-in-Chief of newsrooms where the Publisher requires it.)')}
          </p>
        )}
        {done ? (
          <div className="text-center">
            <p className="text-[15px] font-semibold">{t('2단계 인증을 켰습니다', 'Two-step verification is on')}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              {en
                ? `When you sign in on a new device, you will enter the 6-digit code from your authenticator app. On the same device, you won’t be asked again for ${MFA_DAYS} days (${MFA_DAYS_STAFF} days for Super Admins and Managers) unless you sign out.`
                : `앞으로 새 기기에서 로그인하면 인증 앱의 6자리 코드를 넣습니다. 같은 기기에서는 로그아웃하지 않으면 ${MFA_DAYS}일(총관리자·매니저는 ${MFA_DAYS_STAFF}일) 동안 묻지 않습니다.`}
            </p>
            <p className="mt-3 rounded-md bg-paper px-3 py-2.5 text-left text-[12.5px] leading-relaxed text-muted">
              {t('휴대폰을 잃어버릴 때를 대비해, 내 정보에서 다른 기기(태블릿 등)의 인증 앱을 하나 더 등록해 두면 좋습니다.', 'In case you lose your phone, it helps to register a second authenticator app on another device (such as a tablet) under My account.')}
            </p>
            <button type="button" onClick={() => syncSessionAndGo(next.current)} className="btn-primary mt-5 w-full">{t('계속', 'Continue')}</button>
          </div>
        ) : (
          <>
            <ol className="space-y-1.5 text-[13.5px] leading-relaxed">
              {en ? <>
                <li><strong>1.</strong> Install <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong> from your phone’s app store (free).</li>
                <li><strong>2.</strong> Open the app, tap the <strong>+</strong> button, then <strong>“Scan a QR code”</strong>, and scan the image below.</li>
                <li><strong>3.</strong> Enter the 6-digit number for the new <strong>IM Newsroom</strong> entry in the app below. The number changes every 30 seconds.</li>
              </> : <>
                <li><strong>1.</strong> 휴대폰 앱스토어·플레이스토어에서 <strong>Google Authenticator</strong> 또는 <strong>Microsoft Authenticator</strong>를 설치합니다 (무료).</li>
                <li><strong>2.</strong> 앱을 열고 <strong>+</strong> 버튼 → <strong>“QR 코드 스캔”</strong>을 눌러 아래 그림을 찍습니다.</li>
                <li><strong>3.</strong> 앱에 생긴 <strong>IM Newsroom</strong> 항목의 6자리 숫자를 아래에 넣습니다. 숫자는 30초마다 바뀝니다.</li>
              </>}
            </ol>
            <p className="mt-3 rounded-md bg-paper px-3.5 py-2.5 text-[12.5px] leading-relaxed text-muted">
              {en
                ? `From now on, you only enter the number from the app when signing in on a new device. On the same device, you won’t be asked again for ${MFA_DAYS} days. If you are viewing this screen on your phone, tap “Enter key manually” and type the characters shown into the “Enter a setup key” option in your authenticator app.`
                : `다음부터는 새 기기에서 로그인할 때만 앱의 숫자를 넣습니다. 같은 기기에서는 ${MFA_DAYS}일 동안 다시 묻지 않습니다. 이 화면을 휴대폰으로 보고 있다면 “키 직접 입력”을 눌러 나오는 글자를 인증 앱의 “설정 키 입력”에 넣으세요.`}
            </p>
            <div className="mt-5 grid place-items-center rounded-lg border border-line bg-white p-4">
              {enrolled
                ? <img src={enrolled.qr} alt={t('인증 앱으로 찍을 QR 코드', 'QR code to scan with your authenticator app')} width={184} height={184} className="h-[184px] w-[184px]" />
                : <div className="grid h-[184px] w-[184px] place-items-center text-[13px] text-muted">{error ? t('준비 실패', 'Setup failed') : t('준비하는 중…', 'Preparing…')}</div>}
            </div>
            {enrolled && (
              <div className="mt-2 text-center">
                {showKey
                  ? <p className="break-all font-mono text-[13px] tracking-wide">{secret}</p>
                  : <button type="button" onClick={() => setShowKey(true)} className="text-[12.5px] text-muted underline underline-offset-2">{t('QR을 찍을 수 없나요? 키 직접 입력', 'Can’t scan the QR code? Enter key manually')}</button>}
              </div>
            )}
            <form onSubmit={verify} className="mt-5 space-y-4">
              <div>
                <label htmlFor="code" className="field-label">{t('6자리 코드', '6-digit code')}</label>
                <input
                  id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
                  inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" placeholder="123456" disabled={!enrolled}
                  className="field-input text-center text-[22px] font-semibold tracking-[0.35em] tabular-nums"
                />
              </div>
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={busy || !enrolled} className="btn-primary w-full">{busy ? t('확인 중…', 'Verifying…') : t('확인하고 켜기', 'Verify and turn on')}</button>
            </form>
            <div className="mt-4 flex justify-center gap-2">
              {required ? <SignOutButton /> : <button type="button" onClick={cancel} className="btn-secondary">{t('취소', 'Cancel')}</button>}
            </div>
          </>
        )}
      </div>
    </AuthShell>
  )
}
