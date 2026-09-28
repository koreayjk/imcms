'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { UserRole } from '@/lib/types'
import { BuildingIcon, FolderIcon, LayoutIcon, ListIcon, NewsroomIcon, UsersIcon, WriteIcon } from './icons'

type Item = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean; minRole?: 'editor' | 'admin' }

const ITEMS: Item[] = [
  { href: '/newsroom', label: '뉴스룸', icon: <NewsroomIcon />, match: (p) => p === '/newsroom' },
  { href: '/articles/new', label: '기사쓰기', icon: <WriteIcon />, match: (p) => p === '/articles/new' || p.endsWith('/edit') },
  { href: '/articles', label: '기사목록', icon: <ListIcon />, match: (p) => p === '/articles' || (/^\/articles\/[^/]+$/.test(p) && p !== '/articles/new') },
  { href: '/admin/home', label: '홈편집', icon: <LayoutIcon />, match: (p) => p.startsWith('/admin/home'), minRole: 'editor' },
  { href: '/admin/categories', label: '섹션', icon: <FolderIcon />, match: (p) => p.startsWith('/admin/categories'), minRole: 'editor' },
  { href: '/admin/users', label: '회원', icon: <UsersIcon />, match: (p) => p.startsWith('/admin/users'), minRole: 'admin' },
  { href: '/admin/outlets', label: '매체', icon: <BuildingIcon />, match: (p) => p.startsWith('/admin/outlets'), minRole: 'admin' },
]

export default function Rail({ role }: { role: UserRole | null }) {
  const pathname = usePathname()
  const allowed = (i: Item) =>
    !i.minRole || role === 'admin' || (i.minRole === 'editor' && role === 'editor')

  return (
    <nav aria-label="편집국 메뉴" className="flex w-[76px] shrink-0 flex-col bg-[#262A33] text-[#AEB4C0]">
      <Link href="/newsroom" className="flex h-16 items-center justify-center bg-[#1C1F26] text-[13px] font-extrabold tracking-tight text-white">
        IM
      </Link>
      <ul className="flex-1 py-3">
        {ITEMS.filter(allowed).map((item) => {
          const active = item.match(pathname)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-1 py-3.5 text-[11.5px] transition-colors ${
                  active ? 'bg-white/[0.06] text-[#F2B544]' : 'hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#F2B544]" />}
                {item.icon}
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
