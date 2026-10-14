'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { GDPA, GDPA_EN, gdpaMenu, gdpaRoute } from '@/lib/gdpa'
import GdpaUserNav from './GdpaUserNav'
import GdpaMobileMenu from './GdpaMobileMenu'

// 협회 사이트 머리: 위 띠(로그인) + 로고·메뉴(마우스를 올리면 하위 메뉴)
export default function GdpaHeader({ base }: { base: string }) {
  // 지금 보는 메뉴 (GDPA 도메인이면 주소에 /gdpa 가 없다)
  //   영문판은 주소 앞에 /en (lb = 언어까지 붙인 주소 앞부분)
  const path = usePathname() ?? ''
  const { lang, rel: current } = gdpaRoute(path, base)
  const en = lang === 'en'
  const lb = en ? `${base}/en` : base
  const menu = gdpaMenu(lang)
  const active = (href: string) => !!current && (current === href || current.startsWith(`${href}/`))
  // 같은 화면의 다른 언어 주소
  const other = en ? `${base}${current === '/' ? '' : current}` || '/' : `${base}/en${current === '/' ? '' : current}`
  const name = en ? GDPA_EN.name : GDPA.name
  // 화면 언어 (화면을 옮겨 다닐 때도 맞춘다)
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  // 첫 화면: 큰 사진 위에 투명하게 겹친다
  const home = current === '/' || current === ''
  return (
    <header className={home ? 'absolute inset-x-0 top-0 z-40' : 'relative z-40'}>
      <div className={`text-[12.5px] text-white/70 ${home ? 'border-b border-white/10' : 'bg-[var(--g-navy-d)]'}`}>
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-4">
          <span className="hidden tracking-[0.08em] sm:inline">{en ? GDPA.name : GDPA.nameEn}</span>
          <span className="ml-auto flex items-center gap-4">
            <GdpaUserNav base={lb} lang={lang} />
            <a href={other} lang={en ? 'ko' : 'en'} hrefLang={en ? 'ko' : 'en'} className="rounded-sm border border-white/25 px-2 py-0.5 text-[12px] font-semibold text-white/85 hover:border-white/60 hover:text-white">{en ? '한국어' : 'English'}</a>
          </span>
        </div>
      </div>
      <div className={home ? 'border-b border-white/10' : 'border-b border-[var(--g-line)] bg-white'}>
        <div className="mx-auto flex h-[84px] max-w-[1200px] items-center gap-6 px-4">
          <Link href={lb || '/'} aria-label={en ? `${name} home` : `${name} 처음으로`} className="shrink-0">
            <img src={`/gdpa/logo-full${en ? '-en' : ''}${home ? '-white' : ''}.svg`} alt={`${GDPA.short} ${name}`} className="h-[52px] w-auto" />
          </Link>
          <nav aria-label={en ? 'Main menu' : '주 메뉴'} className="ml-auto hidden lg:block">
            <ul className="flex items-center">
              {menu.map((m) => (
                <li key={m.href} className="group relative">
                  <Link
                    href={`${lb}${m.href}`}
                    aria-current={active(m.href) ? 'page' : undefined}
                    className={`relative block px-5 py-7 text-[16.5px] font-bold tracking-[-0.02em] transition-colors ${home ? 'text-white/90 hover:text-[var(--g-gold)]' : `hover:text-[var(--g-navy)] ${active(m.href) ? 'text-[var(--g-navy)]' : 'text-[var(--g-ink)]'}`}`}
                  >
                    {m.label}
                    {active(m.href) && <span className="absolute inset-x-5 bottom-0 h-[3px] bg-[var(--g-gold)]" />}
                  </Link>
                  {m.children && (
                    <ul className="invisible absolute left-1/2 top-full min-w-[180px] -translate-x-1/2 border-t-[3px] border-[var(--g-gold)] bg-white py-2 opacity-0 shadow-xl ring-1 ring-black/5 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      {m.children.map((c) => (
                        <li key={c.href}>
                          <Link href={`${lb}${c.href}`} className="block whitespace-nowrap px-5 py-2.5 text-[14.5px] text-[var(--g-ink)] hover:bg-[var(--g-soft)] hover:text-[var(--g-navy)]">{c.label}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <GdpaMobileMenu base={lb} lang={lang} other={other} light={home} />
        </div>
      </div>
    </header>
  )
}
