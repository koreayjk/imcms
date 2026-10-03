import Link from 'next/link'
import { childSections, topSections, type SiteConfig } from '@/lib/sites'
import { formatToday } from '@/lib/format'
import Logo from './Logo'
import MobileHeader from './MobileHeader'
import { SearchIcon } from './icons'

// 전체기사 메뉴의 current 값 (섹션 slug와 겹치지 않게)
export const ALL_NEWS = '__all'

type Props = { site: SiteConfig; current?: string }

export default function SiteHeader({ site, current }: Props) {
  const mail = `mailto:${site.legal.email}`
  const tops = topSections(site)
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
              <li>
                <Link
                  href="/news"
                  aria-current={current === ALL_NEWS ? 'page' : undefined}
                  className={`relative block px-[12px] py-2 text-[16.5px] font-semibold tracking-[-0.02em] transition-colors hover:text-brand ${current === ALL_NEWS ? 'text-brand' : 'text-body'}`}
                >
                  전체기사
                  {current === ALL_NEWS && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] bg-gold" />}
                </Link>
              </li>
              {tops.map((s, i) => {
                const kids = childSections(site, s.slug)
                const active = current === s.slug || kids.some((k) => k.slug === current)
                const firstSpecialty = s.specialty && !tops[i - 1]?.specialty
                return (
                  <li key={s.slug} className={`group relative ${firstSpecialty ? 'ml-2 border-l border-rule pl-2' : ''}`}>
                    <Link
                      href={`/section/${s.slug}`}
                      aria-current={current === s.slug ? 'page' : undefined}
                      className={`relative block px-[12px] py-2 text-[16.5px] font-semibold tracking-[-0.02em] transition-colors hover:text-brand ${
                        active ? 'text-brand' : 'text-body'
                      }`}
                    >
                      {s.name}
                      {active && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] bg-gold" />}
                    </Link>
                    {/* 2차 메뉴: 마우스를 올리거나 키보드로 들어가면 펼친다 */}
                    {kids.length > 0 && (
                      <ul className="invisible absolute left-1/2 top-full z-30 min-w-[168px] -translate-x-1/2 border border-rule border-t-[3px] border-t-brand bg-white py-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                        {kids.map((k) => (
                          <li key={k.slug}>
                            <Link
                              href={`/section/${k.slug}`}
                              aria-current={current === k.slug ? 'page' : undefined}
                              className={`block whitespace-nowrap px-4 py-2 text-[14.5px] hover:bg-soft hover:text-brand ${current === k.slug ? 'font-semibold text-brand' : 'text-body'}`}
                            >
                              {k.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
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
