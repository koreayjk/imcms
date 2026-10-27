'use client'

import { Children, useEffect, useRef, type ReactNode } from 'react'

// 넓은 화면(1840px 이상)에서 본문 옆 여백에 띄우는 오른쪽 광고(SiteFrame 의 data-fit-wing)가 본문보다 길면,
//   그 아래 왼쪽의 빈자리에 이미 있는 기사를 이어서 채운다. 서버가 기사를 넉넉히 그려 두고(숨김), 빈자리에 들어가는 만큼만 연다.
//   광고가 없거나 화면이 좁으면 통째로 숨는다.
export default function WingFill({ title, children }: { title: string; children: ReactNode }) {
  const box = useRef<HTMLElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const rows = Children.toArray(children)

  useEffect(() => {
    const sec = box.current
    const ul = list.current
    if (!sec || !ul) return
    let busy = false
    const fit = () => {
      if (busy) return
      busy = true
      const kids = Array.from(ul.children) as HTMLElement[]
      sec.style.display = 'none'
      kids.forEach((k) => { k.style.display = 'none' })
      const wing = document.querySelector<HTMLElement>('[data-fit-wing]')
      const ad = wing && wing.offsetParent !== null ? (wing.firstElementChild as HTMLElement | null) : null
      if (wing && ad) {
        // 광고 칸의 아래 끝 (따라다니는 광고라 위치가 변하므로 칸의 위쪽 + 위 여백 + 광고 높이로 잰다)
        const limit = wing.getBoundingClientRect().top + parseFloat(getComputedStyle(wing).paddingTop) + ad.offsetHeight
        // 격자 칸은 광고 높이만큼 늘어나 있으므로, 본문이 실제로 끝나는 자리는 이 칸의 위쪽으로 잰다
        sec.style.display = ''
        if (limit - sec.getBoundingClientRect().top > 140) {
          let shown = 0
          for (const k of kids) {
            k.style.display = ''
            if (sec.getBoundingClientRect().bottom > limit) { k.style.display = 'none'; break }
            shown++
          }
          if (!shown) sec.style.display = 'none'
        } else sec.style.display = 'none'
      }
      busy = false
    }
    fit()
    const ro = new ResizeObserver(fit)
    const ad = document.querySelector<HTMLElement>('[data-fit-wing]')?.firstElementChild
    if (ad) ro.observe(ad)
    const wide = window.matchMedia('(min-width: 1840px)')
    wide.addEventListener('change', fit)
    window.addEventListener('load', fit)
    const timer = window.setTimeout(fit, 800) // 사진이 늦게 뜨며 본문 높이가 변하는 경우
    return () => { ro.disconnect(); wide.removeEventListener('change', fit); window.removeEventListener('load', fit); window.clearTimeout(timer) }
  }, [rows.length])

  return (
    <section ref={box} aria-label={title} style={{ display: 'none' }} className="mx-auto max-w-[1200px] px-4 pb-8">
      <h2 className="mb-4 border-b-2 border-brand pb-2 text-[18px] font-bold tracking-[-0.02em] text-brand">{title}</h2>
      <ul ref={list} className="divide-y divide-rule">
        {rows}
      </ul>
    </section>
  )
}
