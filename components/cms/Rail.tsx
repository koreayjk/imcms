'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'
import { BuildingIcon, ChartIcon, HeadsetIcon, FolderIcon, InboxIcon, LayoutIcon, ListIcon, MailIcon, NewsroomIcon, UsersIcon, WriteIcon } from './icons'

type Item = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean; minRole?: 'editor' | 'group' | 'outlets' | 'staff' | 'super' }

const ITEMS: Item[] = [
  { href: '/admin/dashboard', label: '대시보드', icon: <ChartIcon />, match: (p) => p.startsWith('/admin/dashboard'), minRole: 'staff' },
  { href: '/newsroom', label: '뉴스룸', icon: <NewsroomIcon />, match: (p) => p === '/newsroom' },
  { href: '/articles/new', label: '기사쓰기', icon: <WriteIcon />, match: (p) => p === '/articles/new' || p.endsWith('/edit') },
  { href: '/articles', label: '기사목록', icon: <ListIcon />, match: (p) => p === '/articles' || (/^\/articles\/[^/]+$/.test(p) && p !== '/articles/new') },
  { href: '/press', label: '보도자료', icon: <InboxIcon />, match: (p) => p.startsWith('/press') },
  { href: '/admin/home', label: '홈편집', icon: <LayoutIcon />, match: (p) => p.startsWith('/admin/home'), minRole: 'editor' },
  { href: '/admin/categories', label: '섹션', icon: <FolderIcon />, match: (p) => p.startsWith('/admin/categories'), minRole: 'editor' },
  { href: '/admin/users', label: '회원', icon: <UsersIcon />, match: (p) => p.startsWith('/admin/users'), minRole: 'group' },
  { href: '/admin/outlets', label: '매체', icon: <BuildingIcon />, match: (p) => p.startsWith('/admin/outlets'), minRole: 'outlets' },
  { href: '/support', label: '고객센터', icon: <HeadsetIcon />, match: (p) => p.startsWith('/support') },
  { href: '/admin/leads', label: '고객상담', icon: <MailIcon />, match: (p) => p.startsWith('/admin/leads'), minRole: 'staff' },
]

type Props = { userName?: string; role: UserRole | null; isSuper?: boolean; isStaff?: boolean; isGroupAdmin?: boolean; pendingCount?: number; supportCount?: number; leadCount?: number }

export default function Rail({ userName = '', role, isSuper = false, isStaff = false, isGroupAdmin = false, pendingCount = 0, supportCount = 0, leadCount = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [pathname])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
  // 편집장 메뉴는 편집장·발행인·총관리자, 그룹 메뉴는 발행인·총관리자, 운영 메뉴는 총관리자만
  const allowed = (i: Item) =>
    !i.minRole
    || (i.minRole === 'editor' && (role === 'editor' || role === 'admin' || isSuper))
    || (i.minRole === 'group' && isGroupAdmin)
    || (i.minRole === 'outlets' && (isGroupAdmin || isStaff))
    || (i.minRole === 'staff' && isStaff)
    || (i.minRole === 'super' && isSuper)

  const items = ITEMS.filter(allowed)
  const badge = (href: string) =>
    href === '/support' ? supportCount : href === '/admin/leads' ? leadCount : href === '/admin/users' ? pendingCount : 0
  const badgeLabel = (href: string, n: number) =>
    href === '/support' ? (isStaff ? `새 요청 ${n}건` : `새 답변 ${n}건`) : href === '/admin/leads' ? `새 상담 ${n}건` : `승인 대기 ${n}명`

  // 휴대폰: 아래 탭 4개 + 더보기 (나머지 메뉴·내 정보·로그아웃)
  const TAB_HREFS = ['/newsroom', '/articles/new', '/articles', '/press']
  const tabs = items.filter((i) => TAB_HREFS.includes(i.href))
  const rest = items.filter((i) => !TAB_HREFS.includes(i.href))
  const restBadge = rest.reduce((a, i) => a + badge(i.href), 0)
  const restActive = rest.some((i) => i.match(pathname)) || pathname.startsWith('/account')

  return (
    <>
      <nav aria-label="편집국 메뉴" className="hidden w-[76px] shrink-0 flex-col overflow-y-auto bg-[#262A33] text-[#AEB4C0] md:flex">
        <Link href="/newsroom" className="flex h-16 shrink-0 items-center justify-center bg-[#1C1F26] text-[13px] font-extrabold tracking-tight text-white">
          IM
        </Link>
        <ul className="flex-1 py-3">
          {items.map((item) => {
            const active = item.match(pathname)
            const n = badge(item.href)
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
                  {n > 0 && (
                    <span className="absolute right-3 top-2 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10.5px] font-bold leading-[18px] text-white" aria-label={badgeLabel(item.href, n)}>
                      {n}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <nav
        aria-label="편집국 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-[#262A33] pb-[env(safe-area-inset-bottom)] text-[#AEB4C0] md:hidden"
      >
        {tabs.map((item) => {
          const active = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'text-[#F2B544]' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          aria-expanded={more}
          className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${restActive ? 'text-[#F2B544]' : ''}`}
        >
          <MoreIcon />
          더보기
          {restBadge > 0 && (
            <span className="absolute right-[calc(50%-22px)] top-1 min-w-[16px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{restBadge}</span>
          )}
        </button>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="전체 메뉴">
          <button type="button" aria-label="메뉴 닫기" onClick={() => setMore(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 text-ink shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-3">
              <Link href="/account" onClick={() => setMore(false)} className="min-w-0">
                <span className="block truncate text-[15px] font-bold">{userName || '내 정보'}</span>
                <span className="text-[12px] text-muted">내 정보·이름 바꾸기 ›</span>
              </Link>
              <button type="button" onClick={logout} className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[13px] text-muted">로그아웃</button>
            </div>
            <ul className="grid grid-cols-4 gap-1">
              {items.map((item) => {
                const active = item.match(pathname)
                const n = badge(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMore(false)}
                      className={`relative flex flex-col items-center gap-1 rounded-xl py-3 text-[12px] ${active ? 'bg-[#FFF6E0] font-bold text-[#8A5A00]' : 'text-[#3A3F4A]'}`}
                    >
                      {item.icon}
                      {item.label}
                      {n > 0 && (
                        <span className="absolute right-2 top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10.5px] font-bold leading-[18px] text-white" aria-label={badgeLabel(item.href, n)}>{n}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}

function MoreIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
    </svg>
  )
}
