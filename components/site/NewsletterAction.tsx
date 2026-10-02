'use client'

import { useState, useTransition } from 'react'
import { confirmNewsletter, unsubscribeNewsletter } from '@/app/newsletter/actions'

// 메일 속 링크를 눌러 들어온 화면: 버튼을 눌러야 처리한다 (메일 보안 검사기가 링크를 미리 열어도 처리되지 않게)
export default function NewsletterAction({ token, mode, siteName }: { token: string; mode: 'confirm' | 'unsubscribe'; siteName: string }) {
  const [result, setResult] = useState<'' | 'ok' | 'bad'>('')
  const [pending, start] = useTransition()
  if (result === 'ok') {
    return <p role="status" className="text-[16px] font-semibold">{mode === 'confirm' ? `구독이 시작되었습니다. ${siteName} 뉴스레터를 보내 드릴게요.` : '수신거부했습니다. 앞으로 뉴스레터가 가지 않습니다.'}</p>
  }
  if (result === 'bad') {
    return <p role="alert" className="text-[15px] text-[#C0392B]">{mode === 'confirm' ? '확인 링크가 만료되었거나 이미 처리되었습니다. 홈페이지에서 다시 신청해 주세요.' : '처리하지 못했습니다. 링크를 다시 확인해 주세요.'}</p>
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        if (mode === 'confirm') setResult((await confirmNewsletter(token)).outlet ? 'ok' : 'bad')
        else setResult((await unsubscribeNewsletter(token)).done ? 'ok' : 'bad')
      })}
      className="bg-brand px-6 py-3 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-60"
    >
      {pending ? '처리 중…' : mode === 'confirm' ? '구독 확인' : '수신거부'}
    </button>
  )
}
