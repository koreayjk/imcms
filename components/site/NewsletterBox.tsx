'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { subscribeNewsletter, type SubscribeState } from '@/app/newsletter/actions'

function Submit() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="shrink-0 bg-brand px-4 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-60">{pending ? '신청 중…' : '구독하기'}</button>
}

// 홈페이지 하단 뉴스레터 구독 (확인 메일의 링크를 눌러야 구독이 시작된다)
export default function NewsletterBox({ siteName }: { siteName: string }) {
  const [state, action] = useFormState<SubscribeState, FormData>(subscribeNewsletter, {})
  if (state.ok) {
    return <p role="status" className="text-[14px] text-body">확인 메일을 보냈습니다. 메일의 “구독 확인”을 누르면 {siteName} 뉴스레터를 받아보실 수 있습니다.</p>
  }
  return (
    <form action={action} className="space-y-2">
      <p className="text-[15px] font-bold text-body">{siteName} 뉴스레터</p>
      <p className="text-[13px] text-sub">주요 기사를 메일로 받아보세요.</p>
      <div className="flex max-w-[460px]">
        <label htmlFor="nl-email" className="sr-only">이메일</label>
        <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder="이메일 주소" className="min-w-0 flex-1 border border-rule bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand" />
        <Submit />
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <label className="flex items-start gap-2 text-[12px] text-sub">
        <input type="checkbox" name="agree" required className="mt-0.5" />
        <span>뉴스레터 발송을 위해 이메일 주소를 수집·이용하는 데 동의합니다. 수신거부할 때까지 보관하며, 메일마다 있는 수신거부 링크로 언제든 끊을 수 있습니다. 동의하지 않으면 구독할 수 없습니다.</span>
      </label>
      {state.error && <p role="alert" className="text-[13px] font-semibold text-[#C0392B]">{state.error}</p>}
    </form>
  )
}
