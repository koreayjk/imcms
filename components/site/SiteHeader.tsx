import Link from 'next/link'
import type { SiteConfig } from '@/lib/sites'
import { formatToday } from '@/lib/format'
import Logo from './Logo'
import MobileHeader from './MobileHeader'
import { SearchIcon } from './icons'

type Props = { site: SiteConfig; current?: string }

export default function SiteHeader({ site, current }: Props) {
  const mail = `mailto:${site.legal.email}`
  return (
    <header>
      {/* PC */}
      <div className="hidden border-b border-rule bg-soft lg:block">
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-4 text-[12px] text-sub">
          <span>{formatToday()}</span>
          <nav className="flex items-center gap-4" aria-label="이용 안내">
            <a href={`${mail}?subject=${encodeURIComponent('[기사제보]')}`} className="hover:text-brand">기사제보</a>
            <a href={`${mail}?subject=${encodeURIComponent('[광고문의]')}`} className="hover:text-brand">광고문의</a>
            <Link href="/login" className="hover:text-brand">편집국 로그인</Link>
          </nav>
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="mx-auto flex h-[104px] max-w-[1200px] items-center gap-6 px-4">
          <Logo site={site} size="lg" />
          <nav className="flex flex-1 justify-end" aria-label="주요 섹션">
            <ul className="flex items-center">
              {site.sections.map((s, i) => {
                const active = current === s.slug
                const firstSpecialty = s.specialty && !site.sections[i - 1]?.specialty
                return (
                  <li key={s.slug} className={firstSpecialty ? 'ml-2 border-l border-rule pl-2' : ''}>
                    <Link
                      href={`/section/${s.slug}`}
                      aria-current={active ? 'page' : undefined}
                      className={`relative block px-[12px] py-2 text-[16.5px] font-semibold tracking-[-0.02em] transition-colors hover:text-brand ${
                        active ? 'text-brand' : 'text-body'
                      }`}
                    >
                      {s.name}
                      {active && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] bg-gold" />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
          <Link
            href="/search"
            aria-label="기사 검색"
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-rule text-body hover:border-brand hover:text-brand"
          >
            <SearchIcon />
          </Link>
        </div>
        <div className="h-1 bg-brand" />
      </div>

      {/* 모바일 */}
      <MobileHeader site={site} current={current} />
    </header>
  )
}
