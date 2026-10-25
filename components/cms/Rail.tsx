'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase'
import type { UserRole } from '@/lib/types'
import { BulbIcon, BuildingIcon, ChartIcon, HeadsetIcon, FolderIcon, GlobeIcon, InboxIcon, LayoutIcon, ListIcon, MailIcon, MegaphoneIcon, NewsroomIcon, GearIcon, ImageIcon, UsersIcon, WriteIcon } from './icons'
import LinkPending from './LinkPending'

type Item = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean; minRole?: 'editor' | 'site' | 'group' | 'outlets' | 'staff' | 'super' }

const ITEMS: Item[] = [
  { href: '/admin/dashboard', label: '대시보드', icon: <ChartIcon />, match: (p) => p.startsWith('/admin/dashboard'), minRole: 'staff' },
  { href: '/newsroom', label: '뉴스룸', icon: <NewsroomIcon />, match: (p) => p === '/newsroom' },
  { href: '/articles/new', label: '기사쓰기', icon: <WriteIcon />, match: (p) => p === '/articles/new' || p.endsWith('/edit') },
  { href: '/articles', label: '기사목록', icon: <ListIcon />, match: (p) => p === '/articles' || (/^\/articles\/[^/]+$/.test(p) && p !== '/articles/new') },
  { href: '/press', label: '보도자료', icon: <InboxIcon />, match: (p) => p.startsWith('/press') },
  { href: '/media', label: '저장 파일', icon: <ImageIcon />, match: (p) => p.startsWith('/media') },
  { href: '/admin/home', label: '홈편집', icon: <LayoutIcon />, match: (p) => p.startsWith('/admin/home'), minRole: 'site' },
  { href: '/admin/categories', label: '섹션', icon: <FolderIcon />, match: (p) => p.startsWith('/admin/categories'), minRole: 'site' },
  { href: '/admin/ads', label: '광고', icon: <MegaphoneIcon />, match: (p) => p.startsWith('/admin/ads'), minRole: 'site' },
  { href: '/admin/newsletter', label: '뉴스레터', icon: <MailIcon />, match: (p) => p.startsWith('/admin/newsletter'), minRole: 'editor' },
  { href: '/admin/users', label: '회원', icon: <UsersIcon />, match: (p) => p.startsWith('/admin/users'), minRole: 'group' },
  { href: '/admin/outlets', label: '매체', icon: <BuildingIcon />, match: (p) => p.startsWith('/admin/outlets'), minRole: 'outlets' },
  { href: '/admin/settings', label: '설정', icon: <GearIcon />, match: (p) => p.startsWith('/admin/settings') },
  { href: '/support', label: '고객센터', icon: <HeadsetIcon />, match: (p) => p.startsWith('/support') && !p.startsWith('/support/onboarding') },
  { href: '/feedback', label: '개선 요청', icon: <BulbIcon />, match: (p) => p.startsWith('/feedback') },
  { href: '/admin/leads', label: '고객상담', icon: <MailIcon />, match: (p) => p.startsWith('/admin/leads'), minRole: 'staff' },
  { href: '/admin/association', label: '협회', icon: <GlobeIcon />, match: (p) => p.startsWith('/admin/association'), minRole: 'staff' },
]

// 개통 진행 현황 메뉴: 고객은 개통(정식 오픈) 전까지 맨 위에 고정, 운영팀은 고객 응대 메뉴 아래에
const FlagIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 21V4" /><path d="M5 5h11l-2 4 2 4H5" /></svg>
)
const ONB_CUSTOMER: Item = { href: '/support/onboarding', label: '개통 현황', icon: <FlagIcon />, match: (p) => p.startsWith('/support/onboarding') }
const ONB_STAFF: Item = { href: '/admin/onboarding', label: '개통현황', icon: <FlagIcon />, match: (p) => p.startsWith('/admin/onboarding'), minRole: 'staff' }

type Props = { userName?: string; role: UserRole | null; isSuper?: boolean; isStaff?: boolean; isGroupAdmin?: boolean; pendingCount?: number; supportCount?: number; leadCount?: number; feedbackCount?: number; onboarding?: boolean; onboardingCount?: number; staffOnboardingCount?: number }

export default function Rail({ userName = '', role, isSuper = false, isStaff = false, isGroupAdmin = false, pendingCount = 0, supportCount = 0, leadCount = 0, feedbackCount = 0, onboarding = false, onboardingCount = 0, staffOnboardingCount = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [pathname])

  // 화면이 낮아 메뉴가 다 안 보이면 아래에 '메뉴 더 있음' 표시 (끝까지 내리면 사라진다)
  const railRef = useRef<HTMLElement>(null)
  const [hidden, setHidden] = useState(false)
  const checkHidden = useCallback(() => {
    const el = railRef.current
    if (el) setHidden(el.scrollHeight - el.scrollTop - el.clientHeight > 4)
  }, [])
  useEffect(() => {
    checkHidden()
    window.addEventListener('resize', checkHidden)
    return () => window.removeEventListener('resize', checkHidden)
  }, [checkHidden])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }
  // 편집장 메뉴는 편집장·발행인·총관리자, 그룹 메뉴는 발행인·총관리자, 운영 메뉴는 총관리자만
  const allowed = (i: Item) =>
    !i.minRole
    || (i.minRole === 'editor' && (role === 'editor' || role === 'admin' || isSuper))
    // 홈페이지 꾸미기(홈편집·섹션·광고): 편집장 이상 + 매니저(고객사 수정 요청 처리)
    || (i.minRole === 'site' && (role === 'editor' || role === 'admin' || isSuper || isStaff))
    || (i.minRole === 'group' && isGroupAdmin)
    || (i.minRole === 'outlets' && (isGroupAdmin || isStaff))
    || (i.minRole === 'staff' && isStaff)
    || (i.minRole === 'super' && isSuper)

  // 운영팀(총관리자·매니저)은 고객 응대 메뉴(고객센터·개선 요청·고객상담)를 대시보드 바로 아래에
  const STAFF_TOP = ['/support', '/feedback', '/admin/leads']
  const visible = ITEMS.filter(allowed)
  const items = isStaff
    ? [
        ...visible.filter((i) => i.href === '/admin/dashboard'),
        ...STAFF_TOP.map((h) => visible.find((i) => i.href === h)).filter((i): i is Item => !!i),
        ...[ONB_STAFF].filter(allowed),
        ...visible.filter((i) => i.href !== '/admin/dashboard' && !STAFF_TOP.includes(i.href)),
      ]
    : onboarding ? [ONB_CUSTOMER, ...visible] : visible
  const badge = (href: string) =>
    href === '/support' ? supportCount : href === '/admin/leads' ? leadCount : href === '/feedback' ? feedbackCount : href === '/admin/users' ? pendingCount : href === '/support/onboarding' ? onboardingCount : href === '/admin/onboarding' ? staffOnboardingCount : 0
  const badgeLabel = (href: string, n: number) =>
    href === '/support' ? (isStaff ? `새 요청 ${n}건` : `새 답변 ${n}건`) : href === '/admin/leads' ? `새 상담 ${n}건` : href === '/support/onboarding' ? `새 답글 ${n}건` : href === '/admin/onboarding' ? `새 고객 글 ${n}건` : href === '/feedback' ? `새 개선 요청 ${n}건` : `승인 대기 ${n}명`

  // 휴대폰: 아래 탭 4개 + 더보기 (나머지 메뉴·내 정보·로그아웃)
  const TAB_HREFS = ['/newsroom', '/articles/new', '/articles', '/press']
  const tabs = items.filter((i) => TAB_HREFS.includes(i.href))
  const rest = items.filter((i) => !TAB_HREFS.includes(i.href))
  const restBadge = rest.reduce((a, i) => a + badge(i.href), 0)
  const restActive = rest.some((i) => i.match(pathname)) || pathname.startsWith('/account')

  return (
    <>
      <nav
        ref={railRef}
        onScroll={checkHidden}
        aria-label="편집국 메뉴"
        className="relative hidden w-[76px] shrink-0 flex-col overflow-y-auto bg-[#262A33] text-[#AEB4C0] [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden"
      >
        <Link href="/newsroom" aria-label="IM 뉴스룸 첫 화면" className="flex h-14 shrink-0 items-center justify-center bg-[#1D3461] [@media(max-height:780px)]:h-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/im-newsroom-mark.svg" alt="" width={54} height={36} className="block [@media(max-height:780px)]:w-[48px]" />
        </Link>
        <ul className="flex-1 py-2 [@media(max-height:780px)]:py-1">
          {items.map((item) => {
            const active = item.match(pathname)
            const n = badge(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  // 화면 높이에 맞춰 간격을 줄인다 (큰 화면 → 노트북 → 낮은 화면)
                  className={`relative flex flex-col items-center gap-1 py-2.5 text-[11.5px] leading-4 transition-colors [@media(min-height:781px)_and_(max-height:900px)]:gap-0.5 [@media(min-height:781px)_and_(max-height:900px)]:py-1.5 [@media(max-height:780px)]:gap-0.5 [@media(max-height:780px)]:py-1 ${
                    active ? 'bg-white/[0.06] text-[#F2B544]' : 'hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-[#F2B544]" />}
                  <LinkPending className="inset-0 bg-white/[0.08] shadow-[inset_3px_0_0_#F2B544]" />
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
        {hidden && (
          <button
            type="button"
            onClick={() => railRef.current?.scrollBy({ top: 240, behavior: 'smooth' })}
            className="sticky bottom-0 -mt-12 flex h-12 w-full shrink-0 flex-col items-center justify-end bg-gradient-to-t from-[#262A33] via-[#262A33]/95 to-transparent pb-1.5 text-[10.5px] text-[#F2B544]"
            aria-label="아래 메뉴 더 보기"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            메뉴 더 있음
          </button>
        )}
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
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'text-[#F2B544]' : ''}`}
            >
              <LinkPending className="inset-x-3 top-0 h-[3px] rounded-b bg-[#F2B544]" />
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
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 text-ink shadow-2xl">
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
