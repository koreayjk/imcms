'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRIAL_JOIN_KEY, TrialConsent, type TrialJoinInfo } from '@/components/auth/TrialSignupForm'
import { useT } from '@/components/cms/CmsLang'
import { joinTrial } from './actions'

// 구글에서 돌아온 뒤: 체험 신청 화면에서 적어 둔 정보가 있으면 바로 체험 계정으로 바꾸고, 없으면 여기서 받는다
export default function CompleteForm({ defaultName }: { defaultName: string }) {
  const t = useT()
  const router = useRouter()
  const [f, setF] = useState({ name: defaultName, company: '', position: '', phone: '' })
  const [agree, setAgree] = useState({ terms: false, privacy: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const started = useRef(false)

  async function join(info: TrialJoinInfo) {
    setBusy(true)
    setError('')
    const r = await joinTrial(info)
    if (r.ok) {
      try { localStorage.removeItem(TRIAL_JOIN_KEY) } catch { /* 무시 */ }
      router.replace('/newsroom')
      router.refresh()
      return
    }
    setError(r.error)
    setBusy(false)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    let saved: TrialJoinInfo | null = null
    try { saved = JSON.parse(localStorage.getItem(TRIAL_JOIN_KEY) ?? 'null') } catch { saved = null }
    if (saved?.company && saved.phone && saved.agreed_at) {
      setF({ name: saved.name || defaultName, company: saved.company, position: saved.position ?? '', phone: saved.phone })
      setAgree({ terms: true, privacy: true })
      join(saved)
    } else setBusy(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!f.name.trim() || !f.company.trim()) return setError(t('이름과 소속 언론사를 적어 주세요.', 'Please enter your name and news organization.'))
    if (!/^[0-9+\-\s]{9,20}$/.test(f.phone.trim())) return setError(t('휴대전화 번호를 확인해 주세요. 예: 010-1234-5678', 'Please check your mobile phone number. Example: 010-1234-5678'))
    if (!agree.terms || !agree.privacy) return setError(t('이용약관과 개인정보 수집·이용에 동의해 주세요.', 'Please agree to the Terms of Service and the collection and use of personal information.'))
    join({ name: f.name.trim(), company: f.company.trim(), position: f.position.trim(), phone: f.phone.trim(), agreed_at: new Date().toISOString() })
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`c-${k}`} className="field-label">{label}</label>
      <input id={`c-${k}`} value={f[k]} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} className="field-input" {...props} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-line bg-white p-6">
      <p className="text-[14px] text-muted">{t('체험 계정을 만들려면 아래 정보를 확인해 주세요.', 'To create your trial account, please confirm the details below.')}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', t('이름 *', 'Name *'), { required: true, maxLength: 30, autoComplete: 'name' })}
        {field('phone', t('휴대전화 *', 'Mobile phone *'), { required: true, type: 'tel', placeholder: '010-1234-5678', autoComplete: 'tel' })}
        {field('company', t('소속 언론사 *', 'News organization *'), { required: true, maxLength: 80, placeholder: t('예: ○○일보', 'e.g. The Daily Post') })}
        {field('position', t('직함', 'Job title'), { maxLength: 40, placeholder: t('예: 대표, 편집국장, 기자', 'e.g. CEO, Editor-in-Chief, Reporter') })}
      </div>
      <TrialConsent agree={agree} setAgree={setAgree} />
      {error && <p role="alert" className="text-[13.5px] text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">{busy ? t('체험 계정을 만드는 중…', 'Creating your trial account…') : t('1주일 무료 체험 시작하기', 'Start your 1-week free trial')}</button>
    </form>
  )
}
