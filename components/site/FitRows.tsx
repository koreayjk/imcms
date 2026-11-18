'use client'

import { Children, cloneElement, isValidElement, useEffect, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react'

// 오른쪽 칸(광고·많이 본 뉴스)이 길어지면 왼쪽 빈자리에 기사를 더 채운다.
//   서버가 기사를 넉넉히 그려 두고, 처음 `min`줄만 항상 보이며 나머지는 오른쪽 칸 높이에 들어가는 만큼만 연다.
//   휴대폰·작은 화면(오른쪽 칸이 아래로 내려오는 화면)에서는 처음 `min`줄만 보인다.
//   바깥 격자에 data-fit-grid, 오른쪽 칸에 data-fit-side 를 달아 둔다.
export default function FitRows({ children, min, as: Tag = 'div', className = '' }: {
  children: ReactNode; min: number; as?: 'div' | 'ul'; className?: string
}) {
  const ref = useRef<HTMLDivElement & HTMLUListElement>(null)
  const rows = Children.toArray(children)

  useEffect(() => {
    const box = ref.current
    if (!box) return
    const side = box.closest('[data-fit-grid]')?.querySelector<HTMLElement>('[data-fit-side]') ?? null
    const wide = window.matchMedia('(min-width: 1024px)')
    const fit = () => {
      const kids = Array.from(box.children) as HTMLElement[]
      kids.forEach((k, i) => { k.style.display = i < min ? '' : 'none' })
      if (!side || !wide.matches) return
      // 오른쪽 칸은 스크롤을 따라다니므로(sticky) 현재 위치가 아니라 격자 맨 위 + 그 칸의 높이로 잰다
      const grid = box.closest('[data-fit-grid]') as HTMLElement | null
      const limit = grid ? grid.getBoundingClientRect().top + parseFloat(getComputedStyle(grid).paddingTop || '0') + side.offsetHeight : side.getBoundingClientRect().bottom
      // 오른쪽 칸 끝까지 왼쪽이 닿을 때까지 줄을 더 연다 (마지막 줄이 조금 넘쳐도 된다 — 오른쪽 칸은 스크롤을 따라다녀 빈 곳이 보이지 않는다)
      let last = kids[Math.min(min, kids.length) - 1]
      for (let i = min; i < kids.length; i++) {
        if (last && last.getBoundingClientRect().bottom >= limit - 8) {
          for (let j = i; j < kids.length; j++) kids[j].style.display = 'none'
          break
        }
        kids[i].style.display = ''
        last = kids[i]
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    if (side) ro.observe(side)
    wide.addEventListener('change', fit)
    return () => { ro.disconnect(); wide.removeEventListener('change', fit) }
  }, [min, rows.length])

  return (
    <Tag ref={ref} className={className}>
      {rows.map((row, i) => {
        // 처음 그릴 때는 덤 기사를 숨겨 둔다 (측정한 뒤에 오른쪽 높이만큼 연다)
        if (i < min || !isValidElement(row)) return row
        const el = row as ReactElement<{ style?: CSSProperties }>
        return cloneElement(el, { style: { ...el.props.style, display: 'none' } })
      })}
    </Tag>
  )
}
