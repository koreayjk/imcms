'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { PublicArticle } from '@/lib/public-data'
import Thumb from './Thumb'

type Tab = { slug: string; name: string; description?: string; articles: PublicArticle[] }

export default function SpecialtyTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0)
  const tab = tabs[active]
  const [lead, ...rest] = tab.articles

  return (
    <div>
      <div role="tablist" aria-label="케어 전문뉴스 분야" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-4">
        {tabs.map((t, i) => (
          <button
            key={t.slug}
            role="tab"
            type="button"
            id={`tab-${t.slug}`}
            aria-selected={i === active}
            aria-controls={`panel-${t.slug}`}
            onClick={() => setActive(i)}
            className={`flex-shrink-0 rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors ${
              i === active ? 'border-brand bg-brand text-white' : 'border-rule bg-white text-body'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab.slug}`} aria-labelledby={`tab-${tab.slug}`} className="border-t-[3px] border-brand bg-white p-4">
        {tab.description && <p className="mb-3 text-[12.5px] text-sub">{tab.description}</p>}
        {lead ? (
          <>
            <Link href={`/news/${lead.id}`} className="group block">
              <Thumb src={lead.thumbnail_url} alt={lead.title} ratio="16 / 9" />
              <p className="mt-3 text-[17px] font-bold leading-[1.4]">{lead.title}</p>
            </Link>
            <ul className="mt-3 divide-y divide-rule border-t border-rule">
              {rest.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="line-clamp-1 block py-3 text-[15px] text-body">
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-6 text-center text-[14px] text-sub">아직 발행된 기사가 없습니다.</p>
        )}
        <Link href={`/section/${tab.slug}`} className="mt-2 block border border-rule py-2.5 text-center text-[14px] text-sub">
          {tab.name} 더보기
        </Link>
      </div>
    </div>
  )
}
