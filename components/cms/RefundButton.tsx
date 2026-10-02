'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refundPayment } from '@/app/(main)/support/payments/actions'

// 운영팀: 결제 전액 취소·환불
export default function RefundButton({ paymentId, amountLabel }: { paymentId: string; amountLabel: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt(`${amountLabel} 전액을 환불합니다. 환불 사유를 적어 주세요.`, '고객 요청 환불')
          if (reason == null) return
          start(async () => { const r = await refundPayment(paymentId, reason); setMsg(r.error ?? r.ok ?? ''); router.refresh() })
        }}
        className="btn-secondary px-2.5 py-1 text-[12px] text-danger"
      >
        {pending ? '환불 중…' : '환불'}
      </button>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </span>
  )
}
