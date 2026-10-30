'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// 휴대폰 홈 톱 기사: 옆으로 밀어 넘기는 카드 줄을, 편집장이 정한 간격마다 앞쪽 `count`장까지 저절로 넘긴다
//   · 손가락으로 만지거나 직접 밀면 멈추고, 마지막 조작 뒤 8초가 지나면 다시 이어서 넘긴다. 움직임 줄이기 설정이면 저절로 넘기지 않는다
//   · 보이는 카드에서 다음 카드로 (마지막 슬라이드 다음엔 첫 카드로 돌아간다). 슬라이드 뒤쪽 카드(톱 왼쪽 기사 등)는 직접 밀어야 보인다
export default function AutoRail({ count, seconds, className, children }: { count: number; seconds: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(0)

  useEffect(() => {
    const box = ref.current
    if (!box || count < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const touch = () => { last.current = Date.now() }
    box.addEventListener('touchstart', touch, { passive: true })
    box.addEventListener('pointerdown', touch, { passive: true })
    box.addEventListener('wheel', touch, { passive: true })
    const ms = Math.max(2, Math.min(30, seconds)) * 1000
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() - last.current < 8000) return
      const kids = Array.from(box.children) as HTMLElement[]
      if (kids.length < 2) return
      const x = box.scrollLeft
      // 지금 맨 앞에 보이는 카드
      let cur = 0
      kids.forEach((k, i) => { if (Math.abs(k.offsetLeft - kids[0].offsetLeft - x) < Math.abs(kids[cur].offsetLeft - kids[0].offsetLeft - x)) cur = i })
      const next = cur + 1 < Math.min(count, kids.length) ? cur + 1 : 0
      box.scrollTo({ left: kids[next].offsetLeft - kids[0].offsetLeft, behavior: 'smooth' })
    }, ms)
    return () => {
      window.clearInterval(id)
      box.removeEventListener('touchstart', touch)
      box.removeEventListener('pointerdown', touch)
      box.removeEventListener('wheel', touch)
    }
  }, [count, seconds])

  return <div ref={ref} className={className}>{children}</div>
}
