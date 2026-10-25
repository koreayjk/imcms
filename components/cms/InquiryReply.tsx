'use client'

import { useActionState, useState } from 'react'
import { replyInquiry, type ReplyState } from '@/app/(main)/admin/inquiries/actions'

// 광고문의에 편집국 안에서 답하기 (문의하신 분 이메일로 나간다)
export default function InquiryReply({ id, email }: { id: string; email: string }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyInquiry.bind(null, id), {})
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-primary px-4 py-1.5 text-[13px]">답하기</button>
  return (
    <form action={action} className="mt-1 w-full space-y-2 rounded-lg border border-line bg-[#F8F9FA] p-3">
      <p className="text-[12.5px] text-muted">받는 사람: {email} (매체 이름으로 나가고, 그분이 답장하면 내 이메일로 옵니다)</p>
      <textarea name="reply" rows={5} required maxLength={4000} placeholder="답변을 적어 주세요." className="field-input resize-y" />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-1.5 text-[13px]">{pending ? '보내는 중…' : '답변 보내기'}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary px-3 py-1.5 text-[13px]">닫기</button>
        {state.error && <p role="alert" className="text-[13px] font-semibold text-danger">{state.error}</p>}
        {state.ok && <p role="status" className="text-[13px] text-published">{state.ok}</p>}
      </div>
    </form>
  )
}
