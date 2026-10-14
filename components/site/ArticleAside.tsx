import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import type { SiteConfig } from '@/lib/sites'
import { formatShort } from '@/lib/format'
import SectionHeading from './SectionHeading'
import MostViewed from './MostViewed'
import AdArea from './AdArea'
import { siteText } from '@/lib/site-text'

// 기사 화면 오른쪽 (많이 본 기사·광고·최신 기사)
export default function ArticleAside({ site, mostViewed, latest }: { site: SiteConfig; mostViewed: PublicArticle[]; latest: PublicArticle[] }) {
  const t = siteText(site)
  return (
    <aside className="space-y-10">
      <MostViewed items={mostViewed} lang={site.lang} />
      <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
      {latest.length > 0 && (
        <section aria-label={t.latest}>
          <SectionHeading title={t.latest} as="h3" lang={site.lang} />
          <ul className="divide-y divide-rule">
            {latest.map((r) => (
              <li key={r.id}>
                <Link href={`/news/${r.id}`} className="group block py-3 first:pt-0">
                  <time className="text-[12px] font-semibold text-brand tabular-nums">{formatShort(r.published_at, site.lang)}</time>
                  <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.45] group-hover:underline underline-offset-2">{r.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
