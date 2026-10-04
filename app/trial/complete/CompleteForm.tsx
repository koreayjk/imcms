'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TRIAL_JOIN_KEY, TrialConsent, type TrialJoinInfo } from '@/components/auth/TrialSignupForm'
import { joinTrial } from './actions'

// 구글에서 돌아온 뒤: 체험 신청 화면에서 적어 둔 정보가 있으면 바로 체험 계정으로 바꾸고, 없으면 여기서 받는다
export default function CompleteForm({ defaultName }: { defaultName: string }) {
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
    if (!f.name.trim() || !f.company.trim()) return setError('이름과 소속 언론사를 적어 주세요.')
    if (!/^[0-9+\-\s]{9,20}$/.test(f.phone.trim())) return setError('휴대전화 번호를 확인해 주세요. 예: 010-1234-5678')
    if (!agree.terms || !agree.privacy) return setError('이용약관과 개인정보 수집·이용에 동의해 주세요.')
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
      <p className="text-[14px] text-muted">체험 계정을 만들려면 아래 정보를 확인해 주세요.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', '이름 *', { required: true, maxLength: 30, autoComplete: 'name' })}
        {field('phone', '휴대전화 *', { required: true, type: 'tel', placeholder: '010-1234-5678', autoComplete: 'tel' })}
        {field('company', '소속 언론사 *', { required: true, maxLength: 80, placeholder: '예: ○○일보' })}
        {field('position', '직함', { maxLength: 40, placeholder: '예: 대표, 편집국장, 기자' })}
      </div>
      <TrialConsent agree={agree} setAgree={setAgree} />
      {error && <p role="alert" className="text-[13.5px] text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">{busy ? '체험 계정을 만드는 중…' : '1주일 무료 체험 시작하기'}</button>
    </form>
  )
}
