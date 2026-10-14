'use client'

import { useState } from 'react'
import Link from 'next/link'
import { gdpaMenu, type GdpaLang } from '@/lib/gdpa'

// 휴대폰 메뉴 (오른쪽에서 열리는 전체 메뉴)
export default function GdpaMobileMenu({ base, lang = 'ko', other, light = false }: { base: string; lang?: GdpaLang; other?: string; light?: boolean }) {
  const [open, setOpen] = useState(false)
  const en = lang === 'en'
  return (
    <div className="ml-auto lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label={en ? 'Open menu' : '전체 메뉴 열기'} aria-expanded={open} className={`grid h-11 w-11 place-items-center ${light ? 'text-white' : 'text-[var(--g-navy)]'}`}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={en ? 'Menu' : '전체 메뉴'}>
          <button type="button" aria-label={en ? 'Close menu' : '메뉴 닫기'} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-y-0 right-0 w-[84%] max-w-[360px] overflow-y-auto bg-white" onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}>
            <div className="flex items-center justify-between bg-[var(--g-navy)] px-5 py-4 text-white">
              <span className="font-bold">{en ? 'Menu' : '전체 메뉴'}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={en ? 'Close menu' : '메뉴 닫기'} className="text-[22px] leading-none">×</button>
            </div>
            <div className="flex gap-2 border-b border-[var(--g-line)] px-5 py-3 text-[14px]">
              <Link href={`${base}/login`} className="flex-1 rounded border border-[var(--g-line)] py-2 text-center">{en ? 'Log in' : '로그인'}</Link>
              <Link href={`${base}/signup`} className="flex-1 rounded bg-[var(--g-navy)] py-2 text-center text-white">{en ? 'Sign up' : '회원가입'}</Link>
            </div>
            <ul className="px-5 py-2">
              {gdpaMenu(lang).map((m) => (
                <li key={m.href} className="border-b border-[var(--g-line)] py-3">
                  <Link href={`${base}${m.href}`} className="text-[17px] font-bold text-[var(--g-navy)]">{m.label}</Link>
                  {m.children && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                      {m.children.map((c) => <li key={c.href}><Link href={`${base}${c.href}`} className="text-[14px] text-[var(--g-sub)]">{c.label}</Link></li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            {other && <a href={other} lang={en ? 'ko' : 'en'} className="mx-5 my-4 block rounded border border-[var(--g-line)] py-2.5 text-center text-[14px] font-semibold text-[var(--g-navy)]">{en ? '한국어' : 'English'}</a>}
          </div>
        </div>
      )}
    </div>
  )
}
