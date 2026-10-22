'use client'

import { useEffect, useState } from 'react'
import type { SiteLang } from '@/lib/sites'

const pill = 'rounded-full border border-rule px-3 py-1.5 text-[12.5px] text-sub transition-colors hover:border-brand hover:text-brand'

// 기사 공유: 카카오톡·페이스북·X·링크 복사 (+ 폰에서는 기기 공유창)
//   카카오톡은 카카오 앱 키 없이 쓸 수 있는 방법이 없어서, 폰에서는 공유창(카카오톡 포함)을 열고 PC에서는 링크를 복사한다
//   미리보기(사진·제목)는 기사 페이지의 og 메타가 만든다
export default function ShareButton({ title, lang }: { title: string; lang?: SiteLang }) {
  const en = lang === 'en'
  const [msg, setMsg] = useState('')
  const [canShare, setCanShare] = useState(false)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  }, [])

  // 쿼리(미리보기·추적 값)를 뺀 기사 주소
  const url = () => `${window.location.origin}${window.location.pathname}`
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 3500) }
  const copy = async (after?: string) => {
    try { await navigator.clipboard.writeText(url()); say(after ?? (en ? 'Link copied.' : '링크가 복사되었습니다.')) } catch { say(en ? 'Could not copy the link.' : '링크를 복사하지 못했습니다.') }
  }
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560')
  const systemShare = () => navigator.share({ title, url: url() }).catch(() => {})

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => (mobile && canShare ? systemShare() : copy(en ? 'Link copied. Paste it into KakaoTalk.' : '링크를 복사했습니다. 카카오톡에 붙여 넣어 보내세요.'))} className={pill}>{en ? 'KakaoTalk' : '카카오톡'}</button>
      <button type="button" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)} className={pill}>{en ? 'Facebook' : '페이스북'}</button>
      <button type="button" onClick={() => open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`)} className={pill}>X</button>
      <button type="button" onClick={() => copy()} className={pill}>{en ? 'Copy link' : '링크 복사'}</button>
      {mobile && canShare && <button type="button" onClick={systemShare} className={pill}>{en ? 'More' : '더보기'}</button>}
      <span role="status" aria-live="polite" className="text-[12px] text-brand">{msg}</span>
    </div>
  )
}
