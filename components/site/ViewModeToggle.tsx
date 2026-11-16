'use client'

import { useEffect, useState } from 'react'

// 휴대폰에서 "PC버전 보기" ↔ "모바일 버전 보기". 쿠키(pcview=1)를 바꾸고 새로 불러온다 (루트 layout 의 viewport 가 이 쿠키를 읽는다)
//   PC 화면(넓은 화면)에서는 "PC버전 보기"를 숨긴다. "모바일 버전 보기"는 PC버전으로 바꾼 사람에게만 보인다
export default function ViewModeToggle({ en, className = '' }: { en?: boolean; className?: string }) {
  const [pc, setPc] = useState(false)
  useEffect(() => { setPc(/(?:^|;\s*)pcview=1(?:;|$)/.test(document.cookie)) }, [])
  const go = () => {
    document.cookie = pc ? 'pcview=; path=/; max-age=0; SameSite=Lax' : 'pcview=1; path=/; max-age=2592000; SameSite=Lax'
    window.location.reload()
  }
  return (
    <button
      type="button"
      onClick={go}
      className={`${pc ? '' : 'lg:hidden'} rounded-full border border-[#C9D0DC] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-body hover:border-body ${className}`}
    >
      {pc ? (en ? 'Mobile version' : '모바일 버전 보기') : en ? 'Desktop version' : 'PC버전 보기'}
    </button>
  )
}
