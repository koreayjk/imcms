'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { SiteConfig } from '@/lib/sites'
import Logo from './Logo'
import { CloseIcon, MenuIcon, SearchIcon } from './icons'

type Props = { site: SiteConfig; current?: string }

export default function MobileHeader({ site, current }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const mail = `mailto:${site.legal.email}`

  useEffect(() => {
    setOpen(false)
    document
      .querySelector('[data-mobile-nav] [aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname])

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

  const general = site.sections.filter((s) => !s.specialty)
  const specialty = site.sections.filter((s) => s.specialty)

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
          <button type="button" aria-label="메뉴 닫기" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-y-0 left-0 flex w-[84%] max-w-[340px] flex-col overflow-y-auto bg-white">
            <div className="flex items-center justify-between border-b border-rule px-4 py-4">
              <Logo site={site} size="md" />
              <button type="button" onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="grid h-10 w-10 place-items-center text-body">
                <CloseIcon />
              </button>
            </div>

            <div className="px-5 py-5">
              <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-gold-ink">케어 전문뉴스</p>
              <ul className="mb-6 divide-y divide-rule border-y border-rule">
                {specialty.map((s) => (
                  <li key={s.slug}>
                    <Link href={`/section/${s.slug}`} className="block py-3">
                      <span className={`block text-[16px] font-bold ${current === s.slug ? 'text-brand' : 'text-body'}`}>{s.name}</span>
                      {s.description && <span className="mt-0.5 block text-[12.5px] text-sub">{s.description}</span>}
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-gold-ink">종합</p>
              <ul className="grid grid-cols-2 gap-2">
                {general.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/section/${s.slug}`}
                      className={`block rounded border px-3 py-2.5 text-center text-[15px] font-semibold ${
                        current === s.slug ? 'border-brand text-brand' : 'border-rule text-body'
                      }`}
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto border-t border-rule bg-soft px-5 py-5 text-[14px]">
              <div className="flex gap-4 text-sub">
                <a href={`${mail}?subject=${encodeURIComponent('[기사제보]')}`}>기사제보</a>
                <a href={`${mail}?subject=${encodeURIComponent('[광고문의]')}`}>광고문의</a>
                <Link href="/login">편집국 로그인</Link>
              </div>
              <p className="mt-4 text-[12.5px] text-sub">{site.slogan}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
