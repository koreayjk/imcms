'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { SiteConfig } from '@/lib/sites'
import Logo from './Logo'
import { ChartTile, ClockTile, CloseIcon, CrownTile, MegaphoneTile, MenuIcon, PenTile, SearchIcon, UserIcon } from './icons'

type Props = { site: SiteConfig; current?: string }

export default function MobileHeader({ site, current }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const mail = `mailto:${site.legal.email}`

  useEffect(() => {
    setOpen(false)
    document
      .querySelector('[data-mobile-nav] [aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
    const hash = window.location.hash.slice(1)
    if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView())
  }, [pathname])

  // 홈 화면의 특정 블록(실시간·많이 본·주요 뉴스)으로 이동
  function jumpTo(id: string) {
    setOpen(false)
    if (pathname === '/') {
      history.replaceState(null, '', `/#${id}`)
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }))
    } else {
      router.push(`/#${id}`)
    }
  }

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="sticky top-0 z-40 bg-white lg:hidden">
      <div className="flex h-14 items-center justify-between border-b border-rule px-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="전체 메뉴 열기"
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center text-body"
        >
          <MenuIcon />
        </button>
        <Logo site={site} size="sm" />
        <Link href="/search" aria-label="기사 검색" className="grid h-11 w-11 place-items-center text-body">
          <SearchIcon />
        </Link>
      </div>

      <nav className="bg-brand" aria-label="주요 섹션">
        <ul data-mobile-nav className="no-scrollbar flex overflow-x-auto px-2">
          <li>
            <Link
              href="/"
              aria-current={pathname === '/' ? 'page' : undefined}
              className={`relative block whitespace-nowrap px-3 py-3 text-[15px] ${pathname === '/' ? 'font-bold text-white' : 'text-white/75'}`}
            >
              홈
              {pathname === '/' && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-gold" />}
            </Link>
          </li>
          <li>
            <Link
              href="/news"
              aria-current={pathname === '/news' ? 'page' : undefined}
              className={`relative block whitespace-nowrap px-3 py-3 text-[15px] ${pathname === '/news' ? 'font-bold text-white' : 'text-white/75'}`}
            >
              전체기사
              {pathname === '/news' && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-gold" />}
            </Link>
          </li>
          {site.sections.map((s) => {
            const active = current === s.slug
            return (
              <li key={s.slug}>
                <Link
                  href={`/section/${s.slug}`}
                  aria-current={active ? 'page' : undefined}
                  className={`relative block whitespace-nowrap px-3 py-3 text-[15px] ${active ? 'font-bold text-white' : 'text-white/75'}`}
                >
                  {s.name}
                  {active && <span className="absolute inset-x-3 bottom-0 h-[3px] bg-gold" />}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="전체 메뉴">
          <button type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)} className="drawer-fade absolute inset-0 bg-black/50" />
          <div
            className="drawer-in absolute inset-y-0 left-0 flex w-[82%] max-w-[360px] flex-col overflow-y-auto bg-[#EFF1F0]"
            onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
          >
            <div className="flex items-center justify-between bg-white py-3 pl-4 pr-2">
              <Logo site={site} size="sm" />
              <div className="flex items-center">
                <Link href="/login" aria-label="편집국 로그인" className="grid h-11 w-11 place-items-center text-body"><UserIcon /></Link>
                <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="grid h-11 w-11 place-items-center text-body">
                  <CloseIcon />
                </button>
              </div>
            </div>

            <form action="/search" className="flex bg-[#2F3431]">
              <label htmlFor="drawer-q" className="sr-only">기사 검색</label>
              <input
                id="drawer-q"
                name="q"
                placeholder="검색어를 입력하세요"
                className="min-w-0 flex-1 bg-transparent px-5 py-4 text-[16px] text-white outline-none placeholder:text-white/40"
              />
              <button type="submit" aria-label="검색" className="grid w-14 place-items-center bg-[#262A27] text-white"><SearchIcon /></button>
            </form>

            <nav aria-label="전체 섹션" className="bg-white px-5 pb-6 pt-4">
              <ul className="grid grid-cols-2 gap-x-4">
                <li>
                  <Link href="/news" aria-current={pathname === '/news' ? 'page' : undefined} className={`block py-3 text-[18px] tracking-[-0.02em] ${pathname === '/news' ? 'font-bold text-brand' : 'text-body'}`}>
                    전체기사
                  </Link>
                </li>
                {site.sections.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/section/${s.slug}`}
                      aria-current={current === s.slug ? 'page' : undefined}
                      className={`block py-3 text-[18px] tracking-[-0.02em] ${
                        current === s.slug ? 'font-bold text-brand' : s.specialty ? 'font-semibold text-brand' : 'text-body'
                      }`}
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <ul className="mt-2 grid grid-cols-3 gap-px bg-[#E2E5E3]">
              {[
                { href: '/#realtime', label: '실시간 뉴스', icon: <ClockTile />, color: 'text-brand' },
                { href: '/#popular', label: '많이 본 뉴스', icon: <ChartTile />, color: 'text-[#3AA79B]' },
                { href: '/#major', label: '주요 뉴스', icon: <CrownTile />, color: 'text-gold' },
                { href: `${mail}?subject=${encodeURIComponent('[기사제보]')}`, label: '기사제보', icon: <PenTile />, color: 'text-[#7B5EA7]' },
                { href: `${mail}?subject=${encodeURIComponent('[광고문의]')}`, label: '광고문의', icon: <MegaphoneTile />, color: 'text-[#3C423E]' },
              ].map((t) => (
                <li key={t.label} className="bg-white">
                  {t.href.startsWith('/#') ? (
                    <button type="button" onClick={() => jumpTo(t.href.slice(2))} className="flex w-full flex-col items-center gap-2 py-5 text-[14.5px] text-body active:bg-soft">
                      <span className={t.color}>{t.icon}</span>
                      {t.label}
                    </button>
                  ) : (
                    <a href={t.href} className="flex flex-col items-center gap-2 py-5 text-[14.5px] text-body active:bg-soft">
                      <span className={t.color}>{t.icon}</span>
                      {t.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-auto px-5 pb-8 pt-8 text-center">
              <p className="text-[13px] text-sub">{site.slogan}</p>
              <p className="mt-1 text-[12px] text-[#8A918C]">© {new Date().getFullYear()} {site.name}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
