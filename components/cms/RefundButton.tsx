'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { refundPayment } from '@/app/(main)/support/payments/actions'

const wonText = (n: number) => `${n.toLocaleString('ko-KR')}원`

// 총관리자: 결제 환불 (전액 또는 일부). 금액과 사유를 묻고 결제사에서 환불한 뒤 기록한다
export default function RefundButton({ paymentId, remaining }: { paymentId: string; remaining: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending || remaining <= 0}
        onClick={() => {
          const raw = window.prompt(`돌려줄 금액을 적어 주세요. (남은 결제 금액 ${wonText(remaining)}, 그대로 두면 전액)\n1년 결제 해지 환불은 “낸 금액 − 쓴 달 수 × 월 요금”입니다 (약관 제10조).`, String(remaining))
          if (raw == null) return
          const amount = Number(raw.replace(/[^\d]/g, ''))
          if (!amount || amount > remaining) { setMsg(`1원 이상 ${wonText(remaining)} 이하로 적어 주세요.`); return }
          const reason = window.prompt(`${wonText(amount)}을 환불합니다. 사유를 적어 주세요. (고객 메일에 나갑니다)`, '고객 요청 환불')
          if (reason == null) return
          if (!window.confirm(`${wonText(amount)}을 정말 환불할까요? 되돌릴 수 없습니다.`)) return
          start(async () => { const r = await refundPayment(paymentId, reason, amount); setMsg(r.error ?? r.ok ?? ''); router.refresh() })
        }}
        className="btn-secondary px-2.5 py-1 text-[12px] text-danger"
      >
        {pending ? '환불 중…' : '환불'}
      </button>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
    </span>
  )
}
