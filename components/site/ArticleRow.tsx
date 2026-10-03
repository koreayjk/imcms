import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import { formatDateTime } from '@/lib/format'
import Thumb from './Thumb'
import { CategoryLabel } from './items'

export default function ArticleRow({ article: a, showCategory = false }: { article: PublicArticle; showCategory?: boolean }) {
  return (
    <li className="py-5 first:pt-0">
      <Link href={`/news/${a.id}`} className="headline-link group flex gap-4 lg:gap-6">
        <div className="min-w-0 flex-1">
          {showCategory && <CategoryLabel article={a} className="mb-1" />}
          <h2 className="headline-text line-clamp-2 text-[16.5px] font-bold leading-[1.42] tracking-[-0.02em] lg:text-[19px]">{a.title}</h2>
          {a.excerpt && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-[1.6] text-sub lg:text-[14.5px]">{a.excerpt}</p>}
          <p className="mt-2 text-[12px] text-[#8A918C] tabular-nums">
            {a.author_name && <span className="mr-2">{a.author_name}</span>}
            {formatDateTime(a.published_at)}
          </p>
        </div>
        {a.thumbnail_url && (
          <Thumb sizes="(max-width: 1023px) 108px, 200px" src={a.thumbnail_url} alt={a.title} ratio="3 / 2" className="w-[108px] flex-shrink-0 lg:w-[200px]" />
        )}
      </Link>
    </li>
  )
}
