import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'

export function CategoryLabel({ article, className = '' }: { article: PublicArticle; className?: string }) {
  if (!article.category) return null
  return <span className={`block text-[12px] font-semibold text-gold-ink ${className}`}>{article.category.name}</span>
}

export function TitleList({ items, className = '' }: { items: PublicArticle[]; className?: string }) {
  if (!items.length) return null
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {items.map((a) => (
        <li key={a.id} className="flex gap-2">
          <span className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-gold" aria-hidden />
          <Link href={`/news/${a.id}`} className="line-clamp-1 text-[14.5px] text-body hover:underline underline-offset-2">
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function AdSlot({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center border border-dashed border-[#C9D1CC] bg-soft text-[12px] text-sub ${className}`}>
      {label}
    </div>
  )
}
