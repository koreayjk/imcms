import Link from 'next/link'
import type { ReactNode } from 'react'
import { GDPA_MENU } from '@/lib/gdpa'

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
      <div className="relative overflow-hidden bg-[var(--g-navy)] text-white">
        <svg aria-hidden className="absolute -right-24 -top-24 h-[360px] w-[360px] opacity-[0.08]" viewBox="0 0 100 100"><g fill="none" stroke="white" strokeWidth="0.8"><circle cx="50" cy="50" r="48" /><ellipse cx="50" cy="50" rx="18" ry="48" /><ellipse cx="50" cy="50" rx="34" ry="48" /><path d="M2 50h96M8 26h84M8 74h84M50 2v96" /></g></svg>
        <div className="relative mx-auto max-w-[1200px] px-4 py-10 md:py-14">
          <p className="text-[12.5px] tracking-[0.2em] text-[var(--g-gold)]">{menu?.label ?? ''}</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.03em] md:text-[36px]">{title}</h1>
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
