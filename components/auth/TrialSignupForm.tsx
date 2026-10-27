'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import GoogleButton from './GoogleButton'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/service-terms'
import { useCmsLang, useT } from '@/components/cms/CmsLang'

// 구글 가입: 구글에 다녀오는 동안 적은 정보를 이 브라우저에 잠시 맡겨 두었다가 /trial/complete 에서 쓴다
export const TRIAL_JOIN_KEY = 'im-trial-join'
export type TrialJoinInfo = { name: string; company: string; position: string; phone: string; agreed_at: string }

// 언어별 두 벌 (모듈 상수에는 t 를 쓸 수 없다)
const CONSENT: Record<'ko' | 'en', [string, string][]> = {
  ko: [
    ['받는 항목', '이름, 이메일, 휴대전화, 소속 언론사·직함'],
    ['쓰는 목적', '체험 계정 제공, 체험 안내, 정식 이용 상담'],
    ['보관 기간', '계정은 체험이 끝나고 30일 뒤 삭제, 상담 기록은 신청일로부터 1년'],
    ['동의 거부', '동의하지 않을 수 있으나, 이 경우 체험을 신청할 수 없습니다'],
  ],
  en: [
    ['Data collected', 'Name, email, mobile phone, news organization and job title'],
    ['Purpose', 'Providing a trial account, trial guidance, and consultation on full service'],
    ['Retention', 'Accounts are deleted 30 days after the trial ends; consultation records are kept for 1 year from the application date'],
    ['If you decline', 'You may decline, but you will not be able to apply for the trial'],
  ],
}

// 1주일 무료 체험 신청: 구글 또는 이메일(인증 메일 확인)로 가입하면 'IM 체험뉴스' 기자로 들어간다 (trial.sql, trial-google.sql)
export default function TrialSignupForm() {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [f, setF] = useState({ name: '', company: '', position: '', phone: '', email: '', pw: '', pw2: '' })
  const [agree, setAgree] = useState({ terms: false, privacy: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [resent, setResent] = useState(false)
  const [googleError, setGoogleError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  // 구글·이메일 모두 필요한 정보
  function checkCommon() {
    if (!f.name.trim() || !f.company.trim()) return t('이름과 소속 언론사를 적어 주세요.', 'Please enter your name and news organization.')
    if (!/^[0-9+\-\s]{9,20}$/.test(f.phone.trim())) return t('휴대전화 번호를 확인해 주세요. 예: 010-1234-5678', 'Please check your mobile phone number. Example: 010-1234-5678')
    if (!agree.terms || !agree.privacy) return t('이용약관과 개인정보 수집·이용에 동의해 주세요.', 'Please agree to the Terms of Service and the collection and use of personal information.')
    return ''
  }

  // 구글로 시작: 확인을 마치면 적은 정보를 맡겨 두고 구글로 간다 (실패하면 false)
  function beforeGoogle() {
    const msg = checkCommon()
    setGoogleError(msg)
    if (msg) return false
    const info: TrialJoinInfo = { name: f.name.trim(), company: f.company.trim(), position: f.position.trim(), phone: f.phone.trim(), agreed_at: new Date().toISOString() }
    try { localStorage.setItem(TRIAL_JOIN_KEY, JSON.stringify(info)) } catch { /* 저장이 막힌 브라우저: 돌아와서 다시 적는다 */ }
    return true
  }

  const confirmUrl = () => `${window.location.origin}/auth/callback?next=/newsroom`

  async function resend() {
    setBusy(true)
    const { error: err } = await createClient().auth.resend({ type: 'signup', email: sentTo, options: { emailRedirectTo: confirmUrl() } })
    setBusy(false)
    setError(err ? (/rate limit|seconds/i.test(err.message) ? t('조금 전에 보냈습니다. 1분쯤 뒤 다시 눌러 주세요.', 'We just sent one. Please try again in about a minute.') : `${t('다시 보내지 못했습니다', 'Could not resend')}: ${err.message}`) : '')
    if (!err) setResent(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const msg = checkCommon()
    if (msg) return setError(msg)
    if (!f.email.trim()) return setError(t('이메일을 적어 주세요.', 'Please enter your email.'))
    if (f.pw.length < 8) return setError(t('비밀번호는 8자 이상으로 정해 주세요.', 'Your password must be at least 8 characters.'))
    if (f.pw !== f.pw2) return setError(t('비밀번호 확인이 일치하지 않습니다.', 'The passwords do not match.'))
    setBusy(true)
    const { data, error: err } = await createClient().auth.signUp({
      email: f.email.trim(),
      password: f.pw,
      options: {
        emailRedirectTo: confirmUrl(),
        data: {
          site: 'trial', full_name: f.name.trim(), company: f.company.trim(), position: f.position.trim(),
          phone: f.phone.trim(), agreed_at: new Date().toISOString(),
          // 동의 기록 (legal-billing-safety.sql: 가입 순간 서버 시각으로 남긴다)
          terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, consent_source: 'trial',
        },
      },
    })
    setBusy(false)
    if (err) {
      if (/already registered|already exists/i.test(err.message)) setError(t('이미 가입된 이메일입니다. 다른 이메일로 신청하거나 로그인해 주세요.', 'This email is already registered. Apply with a different email or sign in.'))
      else if (/rate limit/i.test(err.message)) setError(t('신청이 많아 잠시 막혔습니다. 잠시 뒤 다시 시도해 주세요.', 'Too many requests. Please try again shortly.'))
      else if (/password/i.test(err.message)) setError(t('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해 주세요.', 'That password is too easy to guess. Use at least 8 characters, mixing letters and numbers.'))
      else setError(`${t('신청하지 못했습니다', 'Could not submit your application')}: ${err.message}`)
      return
    }
    // 이메일 인증을 켜 두면 이미 가입된 이메일도 오류 없이 돌아온다 (가입 수단이 비어 있음)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError(t('이미 가입된 이메일입니다. 다른 이메일로 신청하거나 로그인해 주세요.', 'This email is already registered. Apply with a different email or sign in.'))
      return
    }
    if (data.session) { router.push('/newsroom'); router.refresh(); return }
    setSentTo(f.email.trim())
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border border-line bg-white px-6 py-8 text-center">
        <p className="text-[16px] font-bold">{t('인증 메일을 보냈습니다', 'We sent you a verification email')}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{lang === 'en' ? <>Click the <b className="text-ink">email verification</b> link in the inbox of <strong className="text-ink">{sentTo}</strong> to start your trial right away. If you don’t see the email, check your spam folder too.</> : <><strong className="text-ink">{sentTo}</strong> 메일함에서 <b className="text-ink">이메일 인증</b> 링크를 누르면 바로 체험을 시작합니다. 메일이 안 보이면 스팸함도 확인해 주세요.</>}</p>
        <button type="button" onClick={resend} disabled={busy || resent} className="mt-5 text-[13.5px] font-semibold underline underline-offset-2 disabled:no-underline disabled:opacity-60">
          {resent ? t('인증 메일을 다시 보냈습니다', 'Verification email sent again') : busy ? t('보내는 중…', 'Sending…') : t('인증 메일 다시 보내기', 'Resend verification email')}
        </button>
        {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
      </div>
    )
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`t-${k}`} className="field-label">{label}</label>
      <input id={`t-${k}`} value={f[k]} onChange={set(k)} className="field-input" {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-white p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', t('이름 *', 'Name *'), { required: true, maxLength: 30, autoComplete: 'name' })}
        {field('phone', t('휴대전화 *', 'Mobile phone *'), { required: true, type: 'tel', placeholder: '010-1234-5678', autoComplete: 'tel' })}
        {field('company', t('소속 언론사 *', 'News organization *'), { required: true, maxLength: 80, placeholder: t('예: ○○일보', 'e.g. The Daily Post') })}
        {field('position', t('직함', 'Job title'), { maxLength: 40, placeholder: t('예: 대표, 편집국장, 기자', 'e.g. CEO, Editor-in-Chief, Reporter') })}
      </div>
      <TrialConsent agree={agree} setAgree={setAgree} />

      {googleError && <p role="alert" className="text-[13.5px] text-danger">{googleError}</p>}
      <GoogleButton label={t('구글 계정으로 체험 시작하기', 'Start trial with Google')} next="/trial/complete" before={beforeGoogle} />

      <div className="flex items-center gap-3 text-[12.5px] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-line" />{t('또는 이메일로 가입', 'or sign up with email')}<span className="h-px flex-1 bg-line" />
      </div>
      {field('email', t('이메일 (아이디)', 'Email (your login ID)'), { type: 'email', autoComplete: 'email' })}
      <div className="grid gap-4 sm:grid-cols-2">
        {field('pw', t('비밀번호 (8자 이상)', 'Password (at least 8 characters)'), { type: 'password', minLength: 8, autoComplete: 'new-password' })}
        {field('pw2', t('비밀번호 확인', 'Confirm password'), { type: 'password', autoComplete: 'new-password' })}
      </div>
      {error && <p role="alert" className="text-[13.5px] text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">{busy ? t('신청하는 중…', 'Submitting…') : t('이메일로 체험 시작하기', 'Start trial with email')}</button>
      <p className="text-center text-[12.5px] text-muted">{t('이메일로 가입하면 인증 메일의 링크를 눌러야 체험이 시작됩니다.', 'If you sign up with email, your trial starts after you click the link in the verification email.')}</p>
    </form>
  )
}

// 동의 칸 (체험 신청·구글 가입 마무리 화면에서 같이 쓴다)
export function TrialConsent({ agree, setAgree }: { agree: { terms: boolean; privacy: boolean }; setAgree: React.Dispatch<React.SetStateAction<{ terms: boolean; privacy: boolean }>> }) {
  const t = useT()
  const lang = useCmsLang()
  return (
    <div className="space-y-2.5 rounded-lg bg-paper p-4 text-[13px]">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={agree.terms} onChange={(e) => setAgree((a) => ({ ...a, terms: e.target.checked }))} className="mt-0.5" />
        <span><b>{t('[필수]', '[Required]')}</b> {t('이용약관에 동의합니다', 'I agree to the Terms of Service')} <a href="/imnewsroom/terms" target="_blank" className="text-muted underline">{t('전문 보기', 'Read in full')}</a></span>
      </label>
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree((a) => ({ ...a, privacy: e.target.checked }))} className="mt-0.5" />
        <span><b>{t('[필수]', '[Required]')}</b> {t('개인정보 수집·이용에 동의합니다', 'I agree to the collection and use of personal information')} <a href="/imnewsroom/privacy" target="_blank" className="text-muted underline">{t('처리방침 보기', 'View Privacy Policy')}</a></span>
      </label>
      <table className="w-full border-collapse text-[12px]">
        <tbody>
          {CONSENT[lang].map(([k, v]) => (
            <tr key={k} className="border-t border-line">
              <th className="w-20 py-1.5 pr-2 text-left align-top font-semibold">{k}</th>
              <td className="py-1.5 text-muted">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
