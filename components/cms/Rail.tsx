'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import type { UserRole } from '@/lib/types'
import { BuildingIcon, HeadsetIcon, FolderIcon, InboxIcon, LayoutIcon, ListIcon, MailIcon, NewsroomIcon, UsersIcon, WriteIcon } from './icons'

type Item = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean; minRole?: 'editor' | 'group' | 'super' }

const ITEMS: Item[] = [
  { href: '/newsroom', label: '뉴스룸', icon: <NewsroomIcon />, match: (p) => p === '/newsroom' },
  { href: '/articles/new', label: '기사쓰기', icon: <WriteIcon />, match: (p) => p === '/articles/new' || p.endsWith('/edit') },
  { href: '/articles', label: '기사목록', icon: <ListIcon />, match: (p) => p === '/articles' || (/^\/articles\/[^/]+$/.test(p) && p !== '/articles/new') },
  { href: '/press', label: '보도자료', icon: <InboxIcon />, match: (p) => p.startsWith('/press') },
  { href: '/admin/home', label: '홈편집', icon: <LayoutIcon />, match: (p) => p.startsWith('/admin/home'), minRole: 'editor' },
  { href: '/admin/categories', label: '섹션', icon: <FolderIcon />, match: (p) => p.startsWith('/admin/categories'), minRole: 'editor' },
  { href: '/admin/users', label: '회원', icon: <UsersIcon />, match: (p) => p.startsWith('/admin/users'), minRole: 'group' },
  { href: '/admin/outlets', label: '매체', icon: <BuildingIcon />, match: (p) => p.startsWith('/admin/outlets'), minRole: 'group' },
  { href: '/support', label: '고객센터', icon: <HeadsetIcon />, match: (p) => p.startsWith('/support') },
  { href: '/admin/leads', label: '고객상담', icon: <MailIcon />, match: (p) => p.startsWith('/admin/leads'), minRole: 'super' },
]

type Props = { role: UserRole | null; isSuper?: boolean; isGroupAdmin?: boolean; pendingCount?: number; supportCount?: number }

export default function Rail({ role, isSuper = false, isGroupAdmin = false, pendingCount = 0, supportCount = 0 }: Props) {
  const pathname = usePathname()
  // 편집장 메뉴는 편집장·발행인·총관리자, 그룹 메뉴는 발행인·총관리자, 운영 메뉴는 총관리자만
  const allowed = (i: Item) =>
    !i.minRole
    || (i.minRole === 'editor' && (role === 'editor' || role === 'admin' || isSuper))
    || (i.minRole === 'group' && isGroupAdmin)
    || (i.minRole === 'super' && isSuper)

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
                {item.href === '/support' && supportCount > 0 && (
                  <span className="absolute right-3 top-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10.5px] font-bold leading-[18px] text-white" aria-label={isSuper ? `새 요청 ${supportCount}건` : `새 답변 ${supportCount}건`}>
                    {supportCount}
                  </span>
                )}
                {item.href === '/admin/users' && pendingCount > 0 && (
                  <span className="absolute right-3 top-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10.5px] font-bold leading-[18px] text-white" aria-label={`승인 대기 ${pendingCount}명`}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
