'use client'

import { useLayoutEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { rememberSearch, takeRestore } from '@/lib/list-memory'

// 편집국 본문(<main id="app-main">)의 스크롤 자리를 화면마다 기억한다
//   편집국은 창이 아니라 본문 칸이 스크롤되어 브라우저가 자리를 챙겨 주지 못했다
//   · 뒤로·앞으로(아이폰에서 밀어서 뒤로 포함): 그 화면에서 보던 자리로 (전에는 직전 화면의 스크롤 자리가 그대로 남아 엉뚱한 곳이 보였다)
//   · 새로고침(앱에서 당겨서 새로고침 포함): 보던 자리로
//   · 같은 화면에서 고르기·저장으로 주소 뒤 조건만 바뀔 때: 맨 위로 튀지 않고 그 자리에 (쪽 번호가 바뀔 때만 맨 위로)
const KEY = 'im-scroll:'
const read = (url: string) => { try { return Number(sessionStorage.getItem(KEY + url)) || 0 } catch { return 0 } }
const write = (url: string, top: number) => { try { sessionStorage.setItem(KEY + url, String(Math.round(top))) } catch { /* 저장 못 해도 그만 */ } }
const here = () => location.pathname + location.search

// 앱이 주소를 바꾼 것(링크·고르기·저장)인지 알려고 pushState/replaceState에 표시를 단다.
// 표시 없이 주소가 바뀌었으면 뒤로·앞으로다 (popstate 이벤트는 화면을 다 그린 뒤에 와서 쓸 수 없다)
let moved = false
function markHistory() {
  const h = history as History & { __imScroll?: boolean }
  if (h.__imScroll) return
  h.__imScroll = true
  for (const k of ['pushState', 'replaceState'] as const) {
    const orig = h[k].bind(h)
    h[k] = (data: unknown, unused: string, url?: string | URL | null) => {
      if (url != null && new URL(String(url), location.href).href !== location.href) moved = true
      return orig(data, unused, url)
    }
  }
}

export default function ScrollKeeper() {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const shown = useRef<string | null>(null) // 지금 본문에 그려진 화면의 주소
  const stop = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    markHistory()
    const main = document.getElementById('app-main')
    if (!main) return
    let raf = 0
    // 주소가 이미 다음 화면으로 바뀐 뒤(넘어가는 중)의 스크롤은 앞 화면 자리로 적지 않는다
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; if (shown.current && here() === shown.current) write(shown.current, main.scrollTop) })
    }
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => { main.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  useLayoutEffect(() => {
    const main = document.getElementById('app-main')
    const url = pathname + (search ? `?${search}` : '')
    const prev = shown.current
    if (prev === url) return
    shown.current = url
    rememberSearch(pathname, search)
    const byApp = moved
    moved = false
    const restoring = byApp && takeRestore() // "목록으로" 링크로 돌아온 이동
    markHistory()
    if (!main) return
    stop.current()

    let target: number | null = null
    if (prev === null) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) target = read(url)
    } else if (!byApp || restoring) {
      target = read(url)
    } else if (!location.hash && prev.split('?')[0] === pathname) {
      const page = (u: string) => new URLSearchParams(u.split('?')[1] ?? '').get('page')
      if (page(prev) === page(url)) target = read(prev)
    }
    if (target === null) return
    if (target > 0) write(url, target)

    // 내용이 아직 덜 그려졌으면(불러오는 중·사진) 자리가 생길 때까지 잠깐 다시 맞춘다. 사용자가 손대면 멈춘다
    const want = target
    let raf = 0
    const until = performance.now() + 3000
    const cancel = () => { cancelAnimationFrame(raf); main.removeEventListener('touchstart', cancel); main.removeEventListener('wheel', cancel) }
    const tick = () => {
      main.scrollTop = want
      if (Math.abs(main.scrollTop - want) <= 1 || performance.now() > until) return cancel()
      raf = requestAnimationFrame(tick)
    }
    main.addEventListener('touchstart', cancel, { passive: true })
    main.addEventListener('wheel', cancel, { passive: true })
    stop.current = cancel
    tick()
  }, [pathname, search])

  return null
}
