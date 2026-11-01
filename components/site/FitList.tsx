'use client'

import { Children, cloneElement, isValidElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react'

// 오른쪽 칸(많이 본 뉴스)이 왼쪽 칸보다 짧을 때 목록을 더 이어 붙여 빈자리를 채운다. (FitRows 의 반대 방향)
//   서버가 목록을 넉넉히 그려 두고, 처음 `min`개만 항상 보이며 나머지는 왼쪽 칸 끝에 닿을 때까지만 연다.
//   남는 틈이 한 줄보다 작으면 줄 사이를 조금씩 벌려 끝선을 맞춘다.
//   휴대폰·작은 화면(오른쪽 칸이 아래로 내려오는 화면)에서는 처음 `min`개만 보인다.
//   바깥 격자에 data-fit-grid, 오른쪽 칸에 data-fit-side 를 달아 둔다. 왼쪽 칸은 격자의 첫 자식이다.
export default function FitList({ children, min, className = '' }: { children: ReactNode; min: number; className?: string }) {
  const ref = useRef<HTMLOListElement>(null)
  const items = Children.toArray(children)

  useEffect(() => {
    const ol = ref.current
    if (!ol) return
    const grid = ol.closest<HTMLElement>('[data-fit-grid]')
    const side = grid?.querySelector<HTMLElement>('[data-fit-side]') ?? null
    const main = grid && side ? (Array.from(grid.children).find((c) => c !== side) as HTMLElement | undefined) : undefined
    const wide = window.matchMedia('(min-width: 1024px)')

    const fit = () => {
      const kids = Array.from(ol.children) as HTMLElement[]
      kids.forEach((k, i) => { k.style.display = i < min ? '' : 'none'; k.style.paddingBottom = '' })
      if (!side || !main || !wide.matches) return
      const mainEnd = main.lastElementChild as HTMLElement | null
      const sideEnd = side.lastElementChild as HTMLElement | null
      if (!mainEnd || !sideEnd) return
      const target = mainEnd.getBoundingClientRect().bottom
      const sideBottom = () => sideEnd.getBoundingClientRect().bottom
      let shown = Math.min(min, kids.length)
      for (let i = min; i < kids.length; i++) {
        kids[i].style.display = ''
        if (sideBottom() > target) { kids[i].style.display = 'none'; break }
        shown = i + 1
      }
      const spare = target - sideBottom()
      if (shown > 1 && spare > 2) {
        const add = Math.min(spare / (shown - 1), 14)
        for (let i = 0; i < shown - 1; i++) kids[i].style.paddingBottom = `${add}px`
      }
    }

    fit()
    const ro = new ResizeObserver(fit)
    if (main?.lastElementChild) ro.observe(main.lastElementChild)
    if (side) { ro.observe(side); Array.from(side.children).forEach((c) => ro.observe(c)) }
    wide.addEventListener('change', fit)
    window.addEventListener('load', fit)
    return () => { ro.disconnect(); wide.removeEventListener('change', fit); window.removeEventListener('load', fit) }
  }, [min, items.length])

  return (
    <ol ref={ref} className={className}>
      {items.map((it, i) => {
        // 처음 그릴 때는 덤 항목을 숨겨 둔다 (측정한 뒤에 왼쪽 높이만큼 연다)
        if (i < min || !isValidElement(it)) return it
        const el = it as ReactElement<{ style?: CSSProperties }>
        return cloneElement(el, { style: { ...el.props.style, display: 'none' } })
      })}
    </ol>
  )
}
