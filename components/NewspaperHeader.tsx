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
    <header>
      {/* 상단 유틸리티 바 */}
      <div className="bg-navy text-white">
        <div className="mx-auto max-w-[1100px] px-4 h-9 flex items-center justify-between">
          <p className="text-xs text-gray-400">{today}</p>
          <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">
            편집국 로그인 →
          </Link>
        </div>
      </div>

      {/* 마스트헤드 */}
      <div className="bg-white border-b-2 border-ink">
        <div className="mx-auto max-w-[1100px] px-4 py-5 flex items-end justify-between gap-4">
          <Link href="/" className="block">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">{siteName}</h1>
            <p className="mt-1 text-[10px] text-muted tracking-[0.2em] uppercase">News · Media · Community</p>
          </Link>
          <p className="hidden md:block text-xs text-muted text-right pb-1">
            정확하고 빠른 뉴스
          </p>
        </div>
      </div>

      {/* 카테고리 네비게이션 — sticky */}
      <nav className="bg-white border-b border-line shadow-sm sticky top-0 z-20">
        <div className="mx-auto max-w-[1100px] px-4">
          <ul className="flex items-center overflow-x-auto scrollbar-hide">
            <li>
              <Link
                href="/"
                className={`inline-block px-4 py-3 text-sm border-b-[3px] whitespace-nowrap transition-colors ${
                  !currentCategorySlug
                    ? 'border-ink font-bold text-ink'
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
                  className={`inline-block px-4 py-3 text-sm border-b-[3px] whitespace-nowrap transition-colors ${
                    currentCategorySlug === cat.slug
                      ? 'border-review text-review font-bold'
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
    </header>
  )
}
