'use client'

import { useState, useTransition } from 'react'
import { setEmailNotify } from '@/app/(main)/account/actions'
import { useT } from './CmsLang'

// 내 정보: 알림 메일 받기 (승인신청·반려·발행, 업무요청 답변)
export default function EmailNotifyToggle({ initial }: { initial: boolean }) {
  const t = useT()
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
            start(async () => { const r = await setEmailNotify(next); if (r.error) { setOn(!next); setMsg(r.error) } else setMsg(next ? t('알림 메일을 받습니다.', 'You will receive notification emails.') : t('알림 메일을 끕니다.', 'Notification emails are turned off.')) })
          }}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-[14px] font-semibold">{t('알림 메일 받기', 'Receive notification emails')}</span>
          <span className="block text-[12.5px] text-muted">{t('기사 승인신청·반려·발행, 고객센터 업무요청 답변을 메일로 알려 드립니다. 청구서 안내는 결제 담당자에게 따로 갑니다.', 'We email you when a story is submitted for review, rejected or published, and when the Support Center replies to your requests. Invoice notices go separately to the billing contact.')}</span>
        </span>
      </label>
      {msg && <p role="status" className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </div>
  )
}
