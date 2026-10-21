'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Arrow } from './Pill'

type Item = { href: string; label: string }
export type NavLabels = { home: string; menu: string; all: string; login: string; trial: string; trialLong: string; openMenu: string; closeMenu: string; loginLong: string }
const KO: NavLabels = { home: '처음으로', menu: '소개 메뉴', all: '전체 메뉴', login: '로그인', trial: '1주일 무료 체험', trialLong: '1주일 무료 체험 시작', openMenu: '메뉴 열기', closeMenu: '메뉴 닫기', loginLong: '이미 쓰고 있다면 로그인' }

// 소개 페이지 머리: 위에 떠 있는 유리 알약 모양 메뉴
//   휴대폰: 줄 세 개가 X로 접히며, 화면 가득 유리판 메뉴가 열리고 항목이 차례로 떠오른다
//   메뉴는 단추 자리에서 열리고 같은 자리로 닫힌다. 바깥 누르기·Esc·항목 누르기로 닫힌다
export default function IslandNav({ logo, items, loginHref, trialHref, labels = KO }: { logo: ReactNode; items: Item[]; loginHref: string; trialHref: string; labels?: NavLabels }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); btn.current?.focus() } }
    document.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.documentElement.style.overflow = '' }
  }, [open])

  const ease = 'ease-[cubic-bezier(0.32,0.72,0,1)]'
  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-3 pt-3 sm:pt-5">
        <div className={`pointer-events-auto flex w-full max-w-[1120px] items-center gap-4 rounded-full py-2 pl-4 pr-2 transition-[background-color,box-shadow] duration-700 ${ease} sm:pl-5 ${scrolled || open ? 'bg-white/75 shadow-[0_10px_40px_-18px_rgba(16,24,40,0.35),inset_0_0_0_1px_rgba(15,17,21,0.06)] backdrop-blur-xl backdrop-saturate-150' : 'bg-white/40 shadow-[inset_0_0_0_1px_rgba(15,17,21,0.05)] backdrop-blur-md'}`}>
          <a href="#top" aria-label={labels.home} className="shrink-0" onClick={() => setOpen(false)}>{logo}</a>
          <nav className="ml-auto hidden items-center gap-1 whitespace-nowrap text-[14px] text-[#4A505A] lg:flex" aria-label={labels.menu}>
            {items.map((i) => (
              <a key={i.href} href={i.href} className={`rounded-full px-3.5 py-2 transition-colors duration-300 ${ease} hover:bg-[#0F1115]/[0.05] hover:text-[#0F1115]`}>{i.label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 whitespace-nowrap lg:ml-2">
            <Link href={loginHref} className="hidden rounded-full px-3.5 py-2 text-[13.5px] text-[#4A505A] hover:text-[#0F1115] sm:block">{labels.login}</Link>
            <Link href={trialHref} className="pn-press rounded-full bg-[#1D3461] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#152748]">{labels.trial}</Link>
            <button
              ref={btn}
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="island-menu"
              aria-label={open ? labels.closeMenu : labels.openMenu}
              className="pn-press relative grid h-10 w-10 place-items-center rounded-full hover:bg-[#0F1115]/[0.05] lg:hidden"
            >
              {/* 줄 두 개가 돌며 X가 된다 */}
              <span aria-hidden className={`absolute h-[1.5px] w-[18px] rounded-full bg-[#0F1115] transition-transform duration-500 ${ease} ${open ? 'rotate-45' : '-translate-y-[4px]'}`} />
              <span aria-hidden className={`absolute h-[1.5px] w-[18px] rounded-full bg-[#0F1115] transition-transform duration-500 ${ease} ${open ? '-rotate-45' : 'translate-y-[4px]'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* 휴대폰 전체 메뉴: 오른쪽 위 단추 자리에서 펼쳐진다 */}
      <div
        id="island-menu"
        className={`fixed inset-0 z-[35] origin-top-right bg-white/90 backdrop-blur-3xl backdrop-saturate-150 transition-[opacity,transform] duration-700 ${ease} lg:hidden ${open ? 'visible scale-100 opacity-100' : 'pointer-events-none invisible scale-[0.98] opacity-0'}`}
        aria-hidden={!open}
        onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
      >
        <nav className="flex min-h-[100dvh] flex-col px-6 pb-10 pt-28" aria-label={labels.all}>
          <ul className="space-y-1">
            {items.map((i, n) => (
              <li key={i.href} className="overflow-hidden">
                <a
                  href={i.href}
                  onClick={() => setOpen(false)}
                  tabIndex={open ? 0 : -1}
                  className={`block py-2.5 text-[34px] font-extrabold tracking-[-0.04em] text-[#0F1115] transition-[opacity,transform] duration-700 ${ease} ${open ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
                  style={{ transitionDelay: open ? `${80 + n * 50}ms` : '0ms' }}
                >
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
          <div className={`mt-auto flex flex-col gap-3 transition-[opacity,transform] duration-700 ${ease} ${open ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`} style={{ transitionDelay: open ? `${100 + items.length * 50}ms` : '0ms' }}>
            <Link href={trialHref} tabIndex={open ? 0 : -1} className="pn-press flex items-center justify-between rounded-full bg-[#1D3461] py-2 pl-6 pr-2 text-[16px] font-bold text-white">
              {labels.trialLong}
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15"><Arrow /></span>
            </Link>
            <Link href={loginHref} tabIndex={open ? 0 : -1} className="rounded-full py-3 text-center text-[15px] text-[#4A505A]">{labels.loginLong}</Link>
          </div>
        </nav>
      </div>
    </>
  )
}
