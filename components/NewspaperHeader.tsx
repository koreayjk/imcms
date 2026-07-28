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
      {/* ① 최상단 유틸리티 바 */}
      <div className="bg-[#222222] text-white">
        <div className="mx-auto max-w-[1200px] px-4 h-8 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">{today}</p>
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <Link href="/login" className="hover:text-white transition-colors">편집국 로그인</Link>
          </div>
        </div>
      </div>

      {/* ② 마스트헤드 */}
      <div className="bg-white border-b border-[#dddddd]">
        <div className="mx-auto max-w-[1200px] px-4 py-4 flex items-center justify-between gap-6">
          <Link href="/" className="block flex-shrink-0">
            <h1 className="text-[36px] font-bold tracking-tight leading-none text-[#111111]">
              {siteName}
            </h1>
            <p className="mt-0.5 text-[10px] text-[#888888] tracking-[0.18em] uppercase">
              News · Media · Community
            </p>
          </Link>
          {/* 광고 공간 (실제 운영 시 배너 삽입) */}
          <div className="hidden md:flex flex-1 max-w-[468px] h-[60px] border border-[#eeeeee] items-center justify-center bg-[#f9f9f9]">
            <span className="text-[11px] text-[#cccccc]">광고 영역</span>
          </div>
        </div>
      </div>

      {/* ③ 메인 네비게이션 — NDsoft 스타일 다크 네이비 */}
      <nav className="bg-navy sticky top-0 z-20 shadow-md">
        <div className="mx-auto max-w-[1200px] px-4">
          <ul className="flex items-center overflow-x-auto scrollbar-hide">
            <li>
              <Link
                href="/"
                className={`inline-flex items-center h-11 px-5 text-[13px] font-medium whitespace-nowrap border-b-[3px] transition-colors ${
                  !currentCategorySlug
                    ? 'border-white text-white font-bold'
                    : 'border-transparent text-[#aac8ff] hover:text-white hover:border-white/40'
                }`}
              >
                전체
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <Link
                  href={`/?category=${cat.slug}`}
                  className={`inline-flex items-center h-11 px-5 text-[13px] font-medium whitespace-nowrap border-b-[3px] transition-colors ${
                    currentCategorySlug === cat.slug
                      ? 'border-white text-white font-bold'
                      : 'border-transparent text-[#aac8ff] hover:text-white hover:border-white/40'
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
