import Link from 'next/link'
import type { Category } from '@/lib/types'

type Props = {
  siteName: string
  categories: Category[]
  currentCategorySlug?: string
}

export default function NewspaperHeader({ siteName, categories, currentCategorySlug }: Props) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  })

  return (
    <header className="border-b-2 border-ink">
      {/* 상단: 날짜 + 사이트명 */}
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-end justify-between">
          <p className="text-xs text-muted">{today}</p>
          <Link href="/" className="text-xs text-muted hover:text-ink">
            CMS 관리 →
          </Link>
        </div>
      </div>

      {/* 마스트헤드 */}
      <div className="mx-auto max-w-6xl px-4 py-5 text-center">
        <Link href="/" className="inline-block">
          <h1 className="text-4xl font-bold tracking-tight leading-none">{siteName}</h1>
        </Link>
        <p className="mt-1 text-xs text-muted tracking-widest uppercase">
          News · Media · Community
        </p>
      </div>

      {/* 카테고리 네비게이션 */}
      {categories.length > 0 && (
        <nav className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4">
            <ul className="flex items-center gap-0 overflow-x-auto">
              <li>
                <Link
                  href="/"
                  className={`inline-block px-3 py-2.5 text-sm border-b-2 transition-colors ${
                    !currentCategorySlug
                      ? 'border-ink font-semibold'
                      : 'border-transparent text-muted hover:text-ink hover:border-line'
                  }`}
                >
                  전체
                </Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/?category=${cat.slug}`}
                    className={`inline-block px-3 py-2.5 text-sm border-b-2 transition-colors whitespace-nowrap ${
                      currentCategorySlug === cat.slug
                        ? 'border-ink font-semibold'
                        : 'border-transparent text-muted hover:text-ink hover:border-line'
                    }`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
  )
}
