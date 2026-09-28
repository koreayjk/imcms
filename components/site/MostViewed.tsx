import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import SectionHeading from './SectionHeading'

export default function MostViewed({ items }: { items: PublicArticle[] }) {
  if (!items.length) return null
  return (
    <section aria-label="많이 본 뉴스">
      <SectionHeading title="많이 본 뉴스" as="h3" />
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
