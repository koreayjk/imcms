'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { submitBetaRequest, type ApplyState } from '@/app/imnewsroom/actions'

const input =
  'w-full rounded-md border border-[#D5D8DD] bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-[#A3A8B0] focus:border-[#14171C]'

function Field({ id, label, required, children, hint }: { id: string; label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-[#14171C]">
        {label} {required && <span className="text-[#D6402B]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-[#5B616B]">{hint}</p>}
    </div>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-[#D6402B] px-5 py-3.5 text-[15px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? '보내는 중…' : '베타 고객사 신청하기'}
    </button>
  )
}

export default function ApplyForm() {
  const [state, action] = useFormState<ApplyState, FormData>(submitBetaRequest, {})

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-[#14171C] bg-white px-6 py-10 text-center">
        <p className="text-[18px] font-bold">신청을 받았습니다</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#5B616B]">
          적어주신 연락처로 영업일 기준 이틀 안에 연락드리겠습니다.
          <br />
          운영 중인 매체와 필요한 기능을 여쭤보고 일정을 함께 정합니다.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border border-[#E4E6EA] bg-white p-6 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company" label="언론사 이름" required>
          <input id="company" name="company" required maxLength={80} placeholder="창간 준비 중이면 예정 이름" className={input} />
        </Field>
        <Field id="contact_name" label="담당자 이름" required>
          <input id="contact_name" name="contact_name" required maxLength={40} autoComplete="name" className={input} />
        </Field>
        <Field id="phone" label="연락처" required>
          <input id="phone" name="phone" required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="010-0000-0000" className={input} />
        </Field>
        <Field id="email" label="이메일">
          <input id="email" name="email" type="email" maxLength={120} autoComplete="email" className={input} />
        </Field>
        <Field id="outlet_count" label="운영 중인 매체 수">
          <select id="outlet_count" name="outlet_count" defaultValue="" className={input}>
            <option value="">선택</option>
            <option>창간 준비 중</option>
            <option>1개</option>
            <option>2~5개</option>
            <option>6개 이상</option>
          </select>
        </Field>
        <Field id="current_cms" label="지금 쓰는 기사 관리 프로그램">
          <input id="current_cms" name="current_cms" maxLength={80} placeholder="없음 / 프로그램 이름" className={input} />
        </Field>
      </div>
      <Field id="message" label="궁금한 점이나 필요한 기능">
        <textarea id="message" name="message" rows={4} maxLength={2000} className={`${input} resize-y`} />
      </Field>

      {/* 봇 차단용: 사람에게는 보이지 않는다 */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">웹사이트</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <details className="rounded-md bg-[#F4F5F7] px-4 py-3 text-[12.5px] leading-relaxed text-[#5B616B]">
        <summary className="cursor-pointer font-semibold text-[#14171C]">개인정보 수집·이용 안내</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-4">
          <li>수집 항목: 언론사 이름, 담당자 이름, 연락처, 이메일, 운영 매체 수, 사용 중인 프로그램, 문의 내용</li>
          <li>이용 목적: 베타 고객사 신청 상담 및 서비스 안내</li>
          <li>보유 기간: 신청일로부터 1년 (삭제를 요청하면 바로 파기)</li>
          <li>동의하지 않을 수 있으며, 이 경우 신청이 접수되지 않습니다.</li>
        </ul>
      </details>
      <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
        <input type="checkbox" name="agree" className="mt-1 h-4 w-4 accent-[#D6402B]" />
        <span>개인정보 수집·이용에 동의합니다. <span className="text-[#D6402B]">(필수)</span></span>
      </label>

      {state.error && <p role="alert" className="text-[14px] font-semibold text-[#D6402B]">{state.error}</p>}
      <Submit />
    </form>
  )
}
