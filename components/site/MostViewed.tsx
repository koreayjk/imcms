import type { ReactNode } from 'react'
import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import SectionHeading from './SectionHeading'
import type { SiteLang } from '@/lib/sites'
import { siteText } from '@/lib/site-text'
import FitList from './FitList'

// fit: 홈에서 왼쪽 칸이 더 길면 빈자리만큼 목록을 이어 붙인다 (items 를 넉넉히 넘긴다)
export default function MostViewed({ items, lang, fit }: { items: PublicArticle[]; lang?: SiteLang; fit?: boolean }) {
  if (!items.length) return null
  const t = siteText(lang)
  return (
    <section aria-label={t.popular}>
      <SectionHeading title={t.popular} as="h3" lang={lang} />
      <List fit={fit}>
        {items.map((a, i) => (
          <li key={a.id}>
            <Link href={`/news/${a.id}`} className="group flex gap-3">
              <span
                className={`w-5 flex-shrink-0 text-[17px] font-extrabold italic leading-[1.35] tabular-nums ${
                  i < 3 ? 'text-brand' : 'text-[#A9B0AB]'
                }`}
              >
                {i + 1}
              </span>
              <span className="line-clamp-2 text-[14.5px] leading-[1.45] text-body group-hover:underline underline-offset-2">
                {a.title}
              </span>
            </Link>
          </li>
        ))}
      </List>
    </section>
  )
}

function List({ fit, children }: { fit?: boolean; children: ReactNode }) {
  return fit ? <FitList min={8} className="space-y-3">{children}</FitList> : <ol className="space-y-3">{children}</ol>
}
