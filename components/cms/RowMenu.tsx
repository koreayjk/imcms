'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type MenuItem = { label: string; href?: string; newTab?: boolean; onClick?: () => void; tone?: 'danger' | 'strong' }

// 표 한 줄 오른쪽 "관리 ⋯" 메뉴 (회원 관리·광고 계약) (버튼을 여러 줄로 늘어놓지 않는다). 표가 옆으로 스크롤돼도 잘리지 않게 화면 기준으로 띄운다
export default function RowMenu({ items, disabled }: { items: (MenuItem | false | null | undefined)[]; disabled?: boolean }) {
  const list = items.filter(Boolean) as MenuItem[]
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', close)
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', close) }
  }, [pos])
  if (!list.length) return null
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const below = window.innerHeight - r.bottom > list.length * 34 + 16
          setPos(pos ? null : { top: below ? r.bottom + 4 : r.top - list.length * 34 - 12, right: window.innerWidth - r.right })
        }}
        className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-[12.5px] text-muted hover:border-ink hover:text-ink disabled:opacity-50"
      >
        관리 ⋯
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} aria-hidden />
          <div role="menu" className="fixed z-50 w-44 overflow-hidden rounded-md border border-line bg-white py-1 text-left shadow-lg" style={{ top: pos.top, right: pos.right }}>
            {list.map((it) => {
              const cls = `block w-full px-3.5 py-[7px] text-left text-[13px] hover:bg-paper ${it.tone === 'danger' ? 'text-danger' : it.tone === 'strong' ? 'font-semibold text-review' : 'text-ink'}`
              return it.href
                ? <Link key={it.label} href={it.href} role="menuitem" className={cls} onClick={() => setPos(null)} {...(it.newTab ? { target: '_blank', rel: 'noopener' } : {})}>{it.label}{it.newTab ? ' ↗' : ''}</Link>
                : <button key={it.label} type="button" role="menuitem" className={cls} onClick={() => { setPos(null); it.onClick?.() }}>{it.label}</button>
            })}
          </div>
        </>
      )}
    </>
  )
}

