import Link from 'next/link'
import type { ReactNode } from 'react'
import { GDPA_MENU } from '@/lib/gdpa'

// 메뉴별 머리 사진 (public/gdpa/photos)
const PHOTO: Record<string, string> = { '/about': 'mission', '/members': 'partnership', '/activity': 'seminar', '/news': 'newspaper', '/notice': 'camera' }

// 하위 페이지 틀: 메뉴 이름 띠 + 같은 메뉴의 하위 탭 + 본문
export default function SubPage({ base, section, title, current, children, wide = false }: {
  base: string
  section: string
  title: string
  current: string
  children: ReactNode
  wide?: boolean
}) {
  const menu = GDPA_MENU.find((m) => m.href === section)
  return (
    <>
      <div className="relative isolate overflow-hidden bg-[var(--g-navy)] text-white">
        <img src={`/gdpa/photos/${PHOTO[section] ?? 'newspaper'}.jpg`} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35 grayscale" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,28,51,.96)_0%,rgba(13,43,78,.85)_55%,rgba(13,43,78,.6)_100%)]" />
        <div className="relative mx-auto max-w-[1200px] px-4 py-12 md:py-20">
          <p className="flex items-center gap-3 text-[12px] font-semibold tracking-[0.24em] text-[var(--g-gold)]"><span className="h-px w-8 bg-current" aria-hidden />{menu?.label ?? ''}</p>
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.035em] md:text-[42px]">{title}</h1>
        </div>
      </div>
      {menu?.children && (
        <nav aria-label={`${menu.label} 하위 메뉴`} className="border-b border-[var(--g-line)] bg-white">
          <ul className="no-scrollbar mx-auto flex max-w-[1200px] overflow-x-auto px-4">
            {menu.children.map((c) => (
              <li key={c.href}>
                <Link
                  href={`${base}${c.href}`}
                  aria-current={current === c.href ? 'page' : undefined}
                  className={`relative block whitespace-nowrap px-4 py-4 text-[15px] ${current === c.href ? 'font-bold text-[var(--g-navy)]' : 'text-[var(--g-sub)] hover:text-[var(--g-navy)]'}`}
                >
                  {c.label}
                  {current === c.href && <span className="absolute inset-x-4 bottom-0 h-[3px] bg-[var(--g-gold)]" />}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className={`mx-auto px-4 py-10 md:py-14 ${wide ? 'max-w-[1200px]' : 'max-w-[880px]'}`}>{children}</div>
    </>
  )
}
