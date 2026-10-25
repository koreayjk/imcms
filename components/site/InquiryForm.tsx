'use client'

import { useActionState } from 'react'
import { submitAdInquiry, type InquiryState } from '@/app/inquiry/actions'

// 광고문의 양식 (홈페이지 → 편집국 '광고문의'로 접수된다)
export default function InquiryForm({ en = false }: { en?: boolean }) {
  const [state, action, pending] = useActionState<InquiryState, FormData>(submitAdInquiry, {})
  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-rule bg-soft px-6 py-8 text-center">
        <p className="text-[18px] font-bold">{en ? 'Your inquiry has been received.' : '문의가 접수되었습니다.'}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-sub">{en ? 'We will reply to the email address you entered.' : '남겨 주신 이메일로 답변드리겠습니다.'}</p>
      </div>
    )
  }
  const input = 'w-full rounded border border-rule bg-white px-3 py-2.5 text-[15px] focus:border-brand focus:outline-none'
  const label = 'mb-1 block text-[13px] font-semibold'
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={label}>{en ? 'Name' : '성함'} *</span><input name="name" required maxLength={60} autoComplete="name" className={input} /></label>
        <label className="block"><span className={label}>{en ? 'Company' : '회사·단체명'}</span><input name="company" maxLength={100} autoComplete="organization" className={input} /></label>
        <label className="block"><span className={label}>{en ? 'Email' : '답변 받을 이메일'} *</span><input name="email" type="email" required maxLength={200} autoComplete="email" className={input} /></label>
        <label className="block"><span className={label}>{en ? 'Phone' : '연락처'}</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} /></label>
      </div>
      <label className="block"><span className={label}>{en ? 'Inquiry' : '문의 내용'} *</span><textarea name="body" required rows={7} maxLength={4000} placeholder={en ? 'Ad type, period, budget, etc.' : '광고 종류·기간·예산 등을 적어 주세요.'} className={`${input} resize-y`} /></label>
      {/* 봇이 채우는 숨은 칸 */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className="flex items-start gap-2 text-[13px] leading-relaxed text-sub">
        <input type="checkbox" name="agree" className="mt-1" />
        <span>{en ? 'I agree to the collection and use of my name, email and phone number to answer this inquiry (kept for 1 year after completion).' : '문의 답변을 위해 성함·이메일·연락처를 수집·이용하는 데 동의합니다. (처리 완료 후 1년 보관)'}</span>
      </label>
      {state.error && <p role="alert" className="text-[14px] font-semibold text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-brand px-6 py-3 text-[15px] font-bold text-white hover:bg-brand-dark disabled:opacity-60">{pending ? (en ? 'Sending…' : '보내는 중…') : (en ? 'Send inquiry' : '문의 보내기')}</button>
    </form>
  )
}
