'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import AuthShell, { OrDivider } from '@/components/auth/AuthShell'
import GoogleButton from '@/components/auth/GoogleButton'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/service-terms'
import { makeT, type CmsLang } from '@/lib/cms-i18n'

// lang: 서버(signup/page.tsx)가 정한 언어. AuthShell 밖(이 컴포넌트 자신)의 글자에 쓴다
export default function SignupForm({ outlets, lang }: { outlets: { id: string; name: string }[]; lang: CmsLang }) {
  const t = makeT(lang)
  const [name, setName] = useState('')
  // 소속 매체: 매체 id 또는 'unknown'(모름). 목록이 없으면(준비 전) 묻지 않는다
  const [outlet, setOutlet] = useState(outlets.length ? '' : 'unknown')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [agree, setAgree] = useState({ terms: false, privacy: false })
  const agreeError = () => (!agree.terms || !agree.privacy ? t('이용약관과 개인정보 수집·이용에 동의해 주세요.', 'Please agree to the Terms of Service and the collection and use of personal information.') : '')
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError(t('비밀번호는 8자 이상으로 정해주세요.', 'Your password must be at least 8 characters.'))
    if (password !== confirm) return setError(t('비밀번호 확인이 일치하지 않습니다.', 'The passwords do not match.'))
    if (!outlet) return setError(t('소속 매체를 골라 주세요.', 'Please choose your outlet.'))
    if (agreeError()) return setError(agreeError())

    setLoading(true)
    const { data, error: authError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        // 동의 버전은 가입 순간 서버 시각으로 기록된다 (legal-billing-safety.sql)
        data: { full_name: name.trim(), terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, consent_source: 'signup', ...(outlet !== 'unknown' ? { requested_outlet_id: outlet } : {}) },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/pending`,
      },
    })
    setLoading(false)

    if (authError) {
      if (/already registered|already exists/i.test(authError.message)) setError(t('이미 가입된 이메일입니다. 로그인해 주세요.', 'This email is already registered. Please sign in.'))
      else if (/rate limit/i.test(authError.message)) setError(t('가입 요청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도하거나 구글 계정으로 가입해 주세요.', 'Too many sign-up requests. Please try again shortly or sign up with a Google account.'))
      else if (/password/i.test(authError.message)) setError(t('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해주세요.', 'That password is too easy to guess. Use at least 8 characters, mixing letters and numbers.'))
      else setError(`${t('가입하지 못했습니다', 'Could not sign up')}: ${authError.message}`)
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
      <AuthShell lang={lang} subtitle={t('회원가입', 'Sign up')} footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인 화면으로', 'Go to sign in')}</Link>}>
        <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
          <p className="text-[15px] font-semibold">{t('인증 메일을 보냈습니다', 'We sent you a verification email')}</p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {lang === 'en'
              ? <>Click the verification link in the inbox of <strong className="text-ink">{sentTo}</strong>. If you don’t see the email, check your spam folder too.</>
              : <><strong className="text-ink">{sentTo}</strong> 메일함에서 인증 링크를 눌러주세요.
            메일이 안 보이면 스팸함도 확인해 주세요.</>}
          </p>
          <p className="mt-4 rounded bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-muted">{t('인증 후 소속 매체의 발행인이 승인하면 기사를 쓸 수 있습니다.', 'After verification, you can write stories once your outlet’s publisher approves your account.')}</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      lang={lang}
      subtitle={t('편집국 회원가입', 'Newsroom sign-up')}
      footer={<>{t('이미 계정이 있으신가요?', 'Already have an account?')} <Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인', 'Sign in')}</Link></>}
    >
      {outlets.length > 0 && (
        <div className="mb-4">
          <label htmlFor="outlet" className="field-label">{t('소속 매체', 'Outlet')}</label>
          <select id="outlet" value={outlet} onChange={(e) => setOutlet(e.target.value)} required className="field-input">
            <option value="" disabled>{t('어느 매체 기자인지 골라 주세요', 'Choose the outlet you report for')}</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            <option value="unknown">{t('목록에 없음 · 잘 모름', 'Not listed · Not sure')}</option>
          </select>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t('고른 매체의 발행인이 가입을 승인합니다. 구글 가입도 먼저 매체를 골라 주세요.', 'The publisher of the outlet you choose approves your sign-up. Choose your outlet first for Google sign-up too.')}</p>
        </div>
      )}
      <SignupConsent agree={agree} setAgree={setAgree} lang={lang} />
      <GoogleButton label={t('구글 계정으로 가입', 'Sign up with Google')} requestedOutlet={outlet} consent before={() => { const m = agreeError(); setError(m); return !m }} />
      <OrDivider />

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label htmlFor="name" className="field-label">{t('이름 (기사 바이라인에 쓰입니다)', 'Name (used in story bylines)')}</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={30} className="field-input" placeholder={t('홍길동', 'Jane Doe')} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="email" className="field-label">{t('이메일', 'Email')}</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="field-input" placeholder="reporter@example.com" autoComplete="email" />
        </div>
        <div>
          <label htmlFor="password" className="field-label">{t('비밀번호 (8자 이상)', 'Password (at least 8 characters)')}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="field-input" autoComplete="new-password" />
        </div>
        <div>
          <label htmlFor="confirm" className="field-label">{t('비밀번호 확인', 'Confirm password')}</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="field-input" autoComplete="new-password" />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? t('가입하는 중...', 'Signing up...') : t('가입하기', 'Sign up')}
        </button>
        <p className="text-center text-xs leading-relaxed text-muted">{t('가입 후 소속 매체의 발행인이 승인하면 기사를 쓸 수 있습니다.', 'After you sign up, you can write stories once your outlet’s publisher approves your account.')}</p>
      </form>
    </AuthShell>
  )
}

// 편집국 가입 동의 (이용약관 + 개인정보 수집·이용). 구글 가입·이메일 가입 모두 먼저 체크해야 한다
function SignupConsent({ agree, setAgree, lang }: { agree: { terms: boolean; privacy: boolean }; setAgree: React.Dispatch<React.SetStateAction<{ terms: boolean; privacy: boolean }>>; lang: CmsLang }) {
  const t = makeT(lang)
  const all = agree.terms && agree.privacy
  return (
    <div className="mb-4 space-y-2 rounded-lg bg-paper p-4 text-[13px]">
      <label className="flex items-start gap-2 font-semibold">
        <input type="checkbox" checked={all} onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked })} className="mt-0.5" />
        <span>{t('아래 내용에 모두 동의합니다', 'I agree to all of the following')}</span>
      </label>
      <label className="flex items-start gap-2 pl-5">
        <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree((a) => ({ ...a, terms: e.target.checked }))} className="mt-0.5" />
        <span><b>{t('[필수]', '[Required]')}</b> {t('서비스 이용약관', 'Terms of Service')} <a href="/imnewsroom/terms" target="_blank" rel="noopener" className="text-muted underline">{t('전문 보기', 'Read in full')}</a></span>
      </label>
      <label className="flex items-start gap-2 pl-5">
        <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree((a) => ({ ...a, privacy: e.target.checked }))} className="mt-0.5" />
        <span><b>{t('[필수]', '[Required]')}</b> {t('개인정보 수집·이용 (이름·이메일·소속 매체, 로그인·권한 관리와 기자명 표시, 탈퇴하거나 계약이 끝날 때까지 보관)', 'Collection and use of personal information (name, email, outlet; used for sign-in, permission management and byline display; kept until you withdraw or your contract ends)')} <a href="/imnewsroom/privacy" target="_blank" rel="noopener" className="text-muted underline">{t('처리방침 보기', 'View Privacy Policy')}</a></span>
      </label>
    </div>
  )
}
