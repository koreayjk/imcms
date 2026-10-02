'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// 화면에 반 이상 보인 배너만 노출로 센다. 한 페이지의 배너를 모아 한 번에 보낸다
let queue: string[] = []
let timer: ReturnType<typeof setTimeout> | null = null
function flush() {
  const ids = Array.from(new Set(queue)).slice(0, 12)
  queue = []
  timer = null
  if (!ids.length) return
  const body = JSON.stringify({ ids })
  if (!navigator.sendBeacon?.('/api/ad-view', new Blob([body], { type: 'application/json' }))) {
    fetch('/api/ad-view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  }
}

export function useAdView(id: string) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      queue.push(id)
      if (!timer) timer = setTimeout(flush, 1500)
    }, { threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [id])
  return ref
}

export function AdView({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const ref = useAdView(id)
  return <div ref={ref} className={className}>{children}</div>
}
