'use client'

import { useState, useTransition } from 'react'
import { setEmailNotify } from '@/app/(main)/account/actions'

// 내 정보: 알림 메일 받기 (승인신청·반려·발행, 업무요청 답변)
export default function EmailNotifyToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()
  return (
    <div className="border-t border-line pt-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked
            setOn(next)
            start(async () => { const r = await setEmailNotify(next); if (r.error) { setOn(!next); setMsg(r.error) } else setMsg(next ? '알림 메일을 받습니다.' : '알림 메일을 끕니다.') })
          }}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-[14px] font-semibold">알림 메일 받기</span>
          <span className="block text-[12.5px] text-muted">기사 승인신청·반려·발행, 고객센터 업무요청 답변을 메일로 알려 드립니다. 청구서 안내는 결제 담당자에게 따로 갑니다.</span>
        </span>
      </label>
      {msg && <p role="status" className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </div>
  )
}
