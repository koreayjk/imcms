'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { GDPA, GDPA_MENU } from '@/lib/gdpa'
import GdpaUserNav from './GdpaUserNav'
import GdpaMobileMenu from './GdpaMobileMenu'

// 협회 사이트 머리: 위 띠(로그인) + 로고·메뉴(마우스를 올리면 하위 메뉴)
export default function GdpaHeader({ base }: { base: string }) {
  // 지금 보는 메뉴 (GDPA 도메인이면 주소에 /gdpa 가 없다)
  const path = usePathname() ?? ''
  const current = base && path.startsWith(base) ? path.slice(base.length) || '/' : path
  const active = (href: string) => !!current && (current === href || current.startsWith(`${href}/`))
  // 첫 화면: 큰 사진 위에 투명하게 겹친다
  const home = current === '/' || current === ''
  return (
    <header className={home ? 'absolute inset-x-0 top-0 z-40' : 'relative z-40'}>
      <div className={`text-[12.5px] text-white/70 ${home ? 'border-b border-white/10' : 'bg-[var(--g-navy-d)]'}`}>
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-4">
          <span className="hidden tracking-[0.08em] sm:inline">{GDPA.nameEn}</span>
          <GdpaUserNav base={base} className="ml-auto" />
        </div>
      </div>
      <div className={home ? 'border-b border-white/10' : 'border-b border-[var(--g-line)] bg-white'}>
        <div className="mx-auto flex h-[84px] max-w-[1200px] items-center gap-6 px-4">
          <Link href={base || '/'} aria-label={`${GDPA.name} 처음으로`} className="shrink-0">
            <img src={home ? '/gdpa/logo-full-white.svg' : '/gdpa/logo-full.svg'} alt={`${GDPA.short} ${GDPA.name}`} className="h-[52px] w-auto" />
          </Link>
          <nav aria-label="주 메뉴" className="ml-auto hidden lg:block">
            <ul className="flex items-center">
              {GDPA_MENU.map((m) => (
                <li key={m.href} className="group relative">
                  <Link
                    href={`${base}${m.href}`}
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
                          <Link href={`${base}${c.href}`} className="block whitespace-nowrap px-5 py-2.5 text-[14.5px] text-[var(--g-ink)] hover:bg-[var(--g-soft)] hover:text-[var(--g-navy)]">{c.label}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>
          <GdpaMobileMenu base={base} light={home} />
        </div>
      </div>
    </header>
  )
}
