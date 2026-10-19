'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// 소개 페이지의 자세한 기능 설명 묶음: 처음에는 접어 두어 페이지를 짧게 하고, 눌러서 펼친다
//   접혀 있어도 글은 페이지 안에 그대로 있다(검색엔진이 읽는다). 주소에 #뉴스레터 같은 표시가 있어 접힌 안쪽을 가리키면 저절로 펼친다
export default function MoreFeatures({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openIfInside = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      if (id && ref.current?.querySelector(`#${CSS.escape(id)}`)) {
        setOpen(true)
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
      }
    }
    openIfInside()
    window.addEventListener('hashchange', openIfInside)
    return () => window.removeEventListener('hashchange', openIfInside)
  }, [])

  return (
    <details ref={ref} open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="group">
      <summary
        className="pn-press mx-auto my-16 flex w-max max-w-[calc(100%-2rem)] cursor-pointer list-none items-center gap-3 rounded-full bg-white py-2 pl-7 pr-2 text-[16px] font-bold text-[#16294D] shadow-[inset_0_0_0_1px_rgba(15,17,21,0.1),0_14px_34px_-18px_rgba(16,24,40,0.35)] hover:bg-[#F4F6FA] [&::-webkit-details-marker]:hidden"
      >
        <span className="group-open:hidden">기능 자세히 보기 ({count}가지)</span>
        <span className="hidden group-open:inline">기능 설명 접기</span>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#0F1115]/[0.06] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-open:rotate-180">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden><path d="M4 6l4 4 4-4" /></svg>
        </span>
      </summary>
      {children}
    </details>
  )
}
