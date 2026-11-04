'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import Thumb from './Thumb'

// 홈 포토뉴스 띠 (이슈 PICK 아래): 매체 색 바탕에 사진 기사를 4개씩 보여 주고, 화살표(또는 손가락)로 옆으로 넘겨 본다
//   편집판의 '포토뉴스' 칸을 채운 경우에만 홈에 나온다 (app/page.tsx)
export type PhotoItem = { id: string; title: string; excerpt: string | null; thumb: string | null; author: string | null }

export default function PhotoNews({ items, title, color, prevLabel, nextLabel }: { items: PhotoItem[]; title: string; color: string; prevLabel: string; nextLabel: string }) {
  const box = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const el = box.current
    if (!el) return
    setEdge({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    measure()
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, items.length])

  // 한 번에 한 화면(보이는 만큼)씩 넘긴다
  const go = (dir: 1 | -1) => {
    const el = box.current
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' })
  }
  const canScroll = !(edge.start && edge.end)

  return (
    <section aria-label={title} className="mx-auto mb-9 max-w-[1200px] px-4">
      <div className="relative rounded-md px-4 pb-6 pt-5 sm:px-6" style={{ background: color }}>
        <h2 className="mb-4 text-[18px] font-extrabold tracking-[0.02em] text-white">{title}</h2>
        <ul ref={box} onScroll={measure} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1">
          {items.map((a) => (
            <li key={a.id} className="w-[78%] shrink-0 snap-start sm:w-[calc((100%-16px)/2)] lg:w-[calc((100%-48px)/4)]">
              <Link href={`/news/${a.id}`} className="group block">
                <Thumb src={a.thumb} alt={a.title} ratio="3 / 2" sizes="(max-width: 1023px) 78vw, 280px" className="overflow-hidden rounded" />
                <p className="mt-3 line-clamp-2 text-[16px] font-bold leading-[1.45] text-white group-hover:underline underline-offset-2">{a.title}</p>
                {(a.excerpt || a.author) && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-white/70">{[a.author, a.excerpt].filter(Boolean).join(' | ')}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {canScroll && !edge.start && (
          <button type="button" onClick={() => go(-1)} aria-label={prevLabel} className="absolute left-1.5 top-[38%] hidden h-10 w-10 place-items-center rounded-full bg-white/90 text-[18px] font-bold text-[#14171C] shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:grid">‹</button>
        )}
        {canScroll && !edge.end && (
          <button type="button" onClick={() => go(1)} aria-label={nextLabel} className="absolute right-1.5 top-[38%] hidden h-10 w-10 place-items-center rounded-full bg-white/90 text-[18px] font-bold text-[#14171C] shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:grid">›</button>
        )}
      </div>
    </section>
  )
}
