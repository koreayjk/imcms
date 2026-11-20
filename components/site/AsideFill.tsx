'use client'

import { Children, useEffect, useRef, type ReactNode } from 'react'

// 오른쪽 칸(많이 본 뉴스·광고)이 왼쪽(주요뉴스)보다 짧으면, 광고 아래 빈자리에 기사 목록을 이어서 채운다.
//   서버가 기사를 넉넉히 그려 두고(숨김), 왼쪽 높이에 맞는 만큼만 연다. 작은 화면(오른쪽 칸이 아래로 내려오는 화면)에서는 숨는다.
//   FitRows 는 이 칸(data-fit-filler)의 높이를 빼고 오른쪽 칸 높이를 재므로 서로 늘어나는 일이 없다.
export default function AsideFill({ title, children }: { title: string; children: ReactNode }) {
  const box = useRef<HTMLElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const rows = Children.toArray(children)

  useEffect(() => {
    const sec = box.current
    const ul = list.current
    if (!sec || !ul) return
    const side = sec.closest('[data-fit-side]') as HTMLElement | null
    const grid = sec.closest('[data-fit-grid]') as HTMLElement | null
    const left = grid?.querySelector<HTMLElement>(':scope > section') ?? null
    const wide = window.matchMedia('(min-width: 1024px)')
    let busy = false
    const fit = () => {
      if (busy) return
      busy = true
      const kids = Array.from(ul.children) as HTMLElement[]
      sec.style.display = 'none'
      kids.forEach((k) => { k.style.display = 'none' })
      if (side && left && wide.matches) {
        const room = left.offsetHeight - side.offsetHeight
        if (room > 70) {
          sec.style.display = ''
          let shown = 0
          for (const k of kids) {
            k.style.display = ''
            if (side.offsetHeight > left.offsetHeight) { k.style.display = 'none'; break }
            shown++
          }
          if (!shown) sec.style.display = 'none'
        }
      }
      busy = false
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (left) ro.observe(left)
    wide.addEventListener('change', fit)
    window.addEventListener('load', fit)
    const timer = window.setTimeout(fit, 800) // 사진이 늦게 뜨며 높이가 변하는 경우
    return () => { ro.disconnect(); wide.removeEventListener('change', fit); window.removeEventListener('load', fit); window.clearTimeout(timer) }
  }, [rows.length])

  return (
    <section ref={box} data-fit-filler aria-label={title} style={{ display: 'none' }}>
      <h3 className="mb-3 border-b-2 border-brand pb-2 text-[17px] font-bold tracking-[-0.02em] text-brand">{title}</h3>
      <ul ref={list} className="divide-y divide-rule">
        {rows}
      </ul>
    </section>
  )
}
