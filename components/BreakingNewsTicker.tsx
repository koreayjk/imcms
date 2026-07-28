'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

type Item = { id: string; title: string }

export default function BreakingNewsTicker({ items }: { items: Item[] }) {
  const listRef = useRef<HTMLUListElement>(null)

  // CSS animation approach — no JS animation needed
  if (!items.length) return null

  return (
    <div className="bg-white border-b border-[#dddddd] flex items-center overflow-hidden h-9">
      <div className="flex-shrink-0 bg-accent text-white text-xs font-bold px-3 h-full flex items-center gap-1 mr-3">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        속보
      </div>
      <div className="flex-1 overflow-hidden relative">
        <ul
          ref={listRef}
          className="flex gap-8 whitespace-nowrap text-sm text-[#333] ticker-scroll"
        >
          {[...items, ...items].map((item, i) => (
            <li key={`${item.id}-${i}`} className="flex-shrink-0">
              <Link href={`/news/${item.id}`} className="hover:text-navy hover:underline">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
