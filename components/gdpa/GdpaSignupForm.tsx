'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { GDPA_SIGNUP_CONSENT, gdpaTermsSections } from '@/lib/gdpa-policies'
import { GDPA_SIGNUP_CONSENT_EN, gdpaTermsSectionsEn } from '@/lib/gdpa-policies-en'

type Form = { email: string; pw: string; pw2: string; name: string; phone: string; type: 'individual' | 'outlet'; org: string; position: string }

const input = 'w-full rounded border border-[var(--g-line)] px-4 py-3 text-[15px] outline-none focus:border-[var(--g-navy)]'

// 회원가입: 약관·개인정보 동의 → 정보 입력. 이미 로그인한 계정(편집국 회원 등)은 비밀번호 없이 협회 회원 신청만 한다
export default function GdpaSignupForm({ base, loggedInEmail = null, lang = 'ko' }: { base: string; loggedInEmail?: string | null; lang?: 'ko' | 'en' }) {
  const en = lang === 'en'
  const t = (ko: string, eng: string) => (en ? eng : ko)
  const consent = en ? GDPA_SIGNUP_CONSENT_EN : GDPA_SIGNUP_CONSENT
  const router = useRouter()
  const [f, setF] = useState<Form>({ email: '', pw: '', pw2: '', name: '', phone: '', type: 'individual', org: '', position: '' })
  const [agree, setAgree] = useState({ terms: false, privacy: false, age: false, marketing: false })
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }))
  const all = agree.terms && agree.privacy && agree.age && agree.marketing
  const setAll = (v: boolean) => setAgree({ terms: v, privacy: v, age: v, marketing: v })
  useEffect(() => { if (loggedInEmail) set({ email: loggedInEmail }) }, [loggedInEmail])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!agree.terms || !agree.privacy || !agree.age) { setError(t('필수 항목(이용약관, 개인정보 수집·이용, 만 14세 이상)에 동의해 주세요.', 'Please agree to the required items (Terms of Use, collection and use of personal information, aged 14 or older).')); return }
    if (!f.name.trim()) { setError(t('이름을 적어 주세요.', 'Please enter your name.')); return }
    if (!/^[0-9+\-\s]{9,20}$/.test(f.phone.trim())) { setError(t('휴대전화 번호를 확인해 주세요. 예: 010-1234-5678', 'Please check your mobile number, e.g. +82 10-1234-5678.')); return }
    if (f.type === 'outlet' && !f.org.trim()) { setError(t('회원사(언론사)로 신청하면 매체 이름을 적어 주세요.', 'If you are applying as a member outlet, please enter the outlet’s name.')); return }
    const sb = createClient()
    setBusy(true)
    if (loggedInEmail) {
      const { error } = await sb.rpc('gdpa_join', { p_name: f.name, p_phone: f.phone, p_org: f.org, p_position: f.position, p_type: f.type, p_marketing: agree.marketing })
      setBusy(false)
      if (error) { setError(t('신청하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'We could not submit your application. Please try again shortly.')); return }
      router.push(`${base}/mypage`); router.refresh(); return
    }
    if (f.pw.length < 8) { setBusy(false); setError(t('비밀번호는 8자 이상으로 정해 주세요.', 'Your password must be at least 8 characters.')); return }
    if (f.pw !== f.pw2) { setBusy(false); setError(t('두 비밀번호가 같지 않습니다.', 'The two passwords do not match.')); return }
    const now = new Date().toISOString()
    const { data, error } = await sb.auth.signUp({
      email: f.email.trim(),
      password: f.pw,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(`${base}/mypage`)}`,
        data: { site: 'gdpa', lang, name: f.name.trim(), full_name: f.name.trim(), phone: f.phone.trim(), org: f.org.trim(), position: f.position.trim(), member_type: f.type, marketing: agree.marketing, agreed_terms_at: now, agreed_privacy_at: now },
      },
    })
    setBusy(false)
    if (error) {
      setError(/registered|already/i.test(error.message) ? t('이미 가입된 이메일입니다. 로그인한 뒤 “내 정보”에서 협회 회원을 신청해 주세요.', 'This email is already registered. Log in, then apply for GDPA membership from “My account”.') : /password/i.test(error.message) ? t('비밀번호가 너무 쉽습니다. 영문·숫자를 섞어 8자 이상으로 정해 주세요.', 'That password is too easy to guess. Use at least 8 characters, mixing letters and numbers.') : t('가입하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'We could not create your account. Please try again shortly.'))
      return
    }
    if (data.session) { router.push(`${base}/mypage`); router.refresh(); return }
    setDone(en ? `We sent a confirmation email to ${f.email.trim()}. Click the link in it to finish signing up. You can use member services once the Secretariat approves your application. (The email is in Korean.)` : `${f.email.trim()} 으로 가입 확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 끝나고, 사무국 승인 후 회원 서비스를 이용할 수 있습니다.`)
  }

  if (done) return <p role="status" className="rounded-lg border border-[#1E7D4D]/30 bg-[#1E7D4D]/5 px-5 py-6 text-[15.5px] leading-[1.75] text-[#1E5E3D]">{done}</p>

  const check = (k: keyof typeof agree, label: React.ReactNode, required: boolean) => (
    <label className="flex cursor-pointer items-start gap-2.5 text-[15px]">
      <input type="checkbox" checked={agree[k]} onChange={(e) => setAgree((a) => ({ ...a, [k]: e.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--g-navy)]" />
      <span><span className={required ? 'font-bold text-[var(--g-navy)]' : 'text-[var(--g-sub)]'}>[{required ? t('필수', 'Required') : t('선택', 'Optional')}]</span> {label}</span>
    </label>
  )

  return (
    <form onSubmit={submit} className="space-y-10">
      {/* 1. 약관 동의 */}
      <section>
        <h2 className="text-[18px] font-bold">{t('1. 약관 동의', '1. Consent')}</h2>
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg bg-[var(--g-soft)] px-4 py-3.5 text-[16px] font-bold">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-5 w-5 accent-[var(--g-navy)]" />
          {t('모두 동의합니다', 'I agree to all')}
        </label>
        <div className="mt-4 space-y-4">
          <div>
            {check('terms', <>{t('이용약관 동의', 'I agree to the Terms of Use')} <a href={`${base}/terms`} target="_blank" className="text-[13px] text-[var(--g-sub)] underline">{t('전문 보기', 'Read in full')}</a></>, true)}
            <div className="mt-2 h-36 overflow-y-auto rounded border border-[var(--g-line)] p-3 text-[13px] leading-[1.7] text-[var(--g-sub)]" tabIndex={0} aria-label={t('이용약관', 'Terms of Use')}>
              {(en ? gdpaTermsSectionsEn() : gdpaTermsSections()).map((s) => (
                <div key={s.title} className="mb-2">
                  <p className="font-semibold text-[var(--g-ink)]">{s.title}</p>
                  {s.body.map((b, i) => (Array.isArray(b) ? <ul key={i} className="list-disc pl-5">{b.map((x, j) => (j === 0 ? <p key={j} className="-ml-5">{x}</p> : <li key={j}>{x}</li>))}</ul> : <p key={i}>{b}</p>))}
                </div>
              ))}
            </div>
          </div>
          <div>
            {check('privacy', <>{t('개인정보 수집·이용 동의', 'I agree to the collection and use of my personal information')} <a href={`${base}/privacy`} target="_blank" className="text-[13px] text-[var(--g-sub)] underline">{t('처리방침 보기', 'Privacy Policy')}</a></>, true)}
            <table className="mt-2 w-full border-collapse text-[13px]">
              <tbody>
                {consent.required.map(([k, v]) => (
                  <tr key={k} className="border border-[var(--g-line)]">
                    <th className="w-24 bg-[var(--g-soft)] px-3 py-2 text-left font-semibold">{k}</th>
                    <td className="px-3 py-2 leading-[1.6] text-[var(--g-sub)]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {check('age', t('만 14세 이상입니다', 'I am aged 14 or older'), true)}
          {check('marketing', consent.marketing, false)}
        </div>
      </section>

      {/* 2. 회원 정보 */}
      <section>
        <h2 className="text-[18px] font-bold">{t('2. 회원 정보', '2. Your details')}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="s-email" className="mb-1.5 block text-[14px] font-semibold">{t('이메일 (아이디) *', 'Email (your login) *')}</label>
            <input id="s-email" type="email" autoComplete="email" required disabled={!!loggedInEmail} value={f.email} onChange={(e) => set({ email: e.target.value })} className={`${input} disabled:bg-[var(--g-soft)]`} />
          </div>
          {!loggedInEmail && (
            <>
              <div>
                <label htmlFor="s-pw" className="mb-1.5 block text-[14px] font-semibold">{t('비밀번호 *', 'Password *')} <span className="font-normal text-[var(--g-sub)]">{t('(8자 이상)', '(8+ characters)')}</span></label>
                <input id="s-pw" type="password" autoComplete="new-password" required value={f.pw} onChange={(e) => set({ pw: e.target.value })} className={input} />
              </div>
              <div>
                <label htmlFor="s-pw2" className="mb-1.5 block text-[14px] font-semibold">{t('비밀번호 확인 *', 'Confirm password *')}</label>
                <input id="s-pw2" type="password" autoComplete="new-password" required value={f.pw2} onChange={(e) => set({ pw2: e.target.value })} className={input} />
              </div>
            </>
          )}
          <div>
            <label htmlFor="s-name" className="mb-1.5 block text-[14px] font-semibold">{t('이름 *', 'Name *')}</label>
            <input id="s-name" autoComplete="name" required maxLength={40} value={f.name} onChange={(e) => set({ name: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="s-phone" className="mb-1.5 block text-[14px] font-semibold">{t('휴대전화 *', 'Mobile phone *')}</label>
            <input id="s-phone" type="tel" autoComplete="tel" required placeholder={t('010-1234-5678', '+82 10-1234-5678')} value={f.phone} onChange={(e) => set({ phone: e.target.value })} className={input} />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[14px] font-semibold">{t('회원 유형 *', 'Membership type *')}</legend>
            <div className="flex flex-wrap gap-3">
              {(en ? [['individual', 'Individual member', 'GDPA news, events and training'], ['outlet', 'Member outlet (news outlet)', 'Membership application for a news outlet, registered after review']] as const : [['individual', '개인회원', '협회 소식·행사·교육 안내'], ['outlet', '회원사(언론사)', '언론사 입회 신청 · 심사 후 회원사 등록']] as const).map(([v, label, d]) => (
                <label key={v} className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border px-4 py-3 ${f.type === v ? 'border-[var(--g-navy)] bg-[var(--g-soft)]' : 'border-[var(--g-line)]'}`}>
                  <input type="radio" name="mtype" checked={f.type === v} onChange={() => set({ type: v })} className="mt-1 accent-[var(--g-navy)]" />
                  <span><span className="block font-bold">{label}</span><span className="text-[13px] text-[var(--g-sub)]">{d}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="s-org" className="mb-1.5 block text-[14px] font-semibold">{t('소속', 'Organization')} {f.type === 'outlet' ? t('(매체 이름) *', '(outlet name) *') : t('(선택)', '(optional)')}</label>
            <input id="s-org" maxLength={80} value={f.org} onChange={(e) => set({ org: e.target.value })} className={input} />
          </div>
          <div>
            <label htmlFor="s-pos" className="mb-1.5 block text-[14px] font-semibold">{t('직함 (선택)', 'Title (optional)')}</label>
            <input id="s-pos" maxLength={40} placeholder={t('예: 발행인, 편집국장, 기자', 'e.g. Publisher, Editor-in-chief, Reporter')} value={f.position} onChange={(e) => set({ position: e.target.value })} className={input} />
          </div>
        </div>
      </section>

      {error && <p role="alert" className="rounded border border-[#B3392C]/30 bg-[#B3392C]/5 px-4 py-3 text-[14.5px] text-[#B3392C]">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded bg-[var(--g-navy)] py-4 text-[17px] font-bold text-white disabled:opacity-60">
        {busy ? t('처리 중…', 'Working…') : loggedInEmail ? t('협회 회원 신청하기', 'Apply for GDPA membership') : t('회원가입', 'Sign up')}
      </button>
    </form>
  )
}
