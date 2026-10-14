import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import SectionHeading from './SectionHeading'
import type { SiteLang } from '@/lib/sites'
import { siteText } from '@/lib/site-text'

export default function MostViewed({ items, lang }: { items: PublicArticle[]; lang?: SiteLang }) {
  if (!items.length) return null
  const t = siteText(lang)
  return (
    <section aria-label={t.popular}>
      <SectionHeading title={t.popular} as="h3" lang={lang} />
      <ol className="space-y-3">
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
      </ol>
    </section>
  )
}
