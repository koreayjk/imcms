'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { ROLE_LABEL } from '@/lib/types'

type NavItem = { href: string; label: string; exact?: boolean }

const MAIN_NAV: NavItem[] = [
  { href: '/articles', label: '기사 목록' },
  { href: '/articles/new', label: '새 기사 작성', exact: true },
]

const EDITOR_NAV: NavItem[] = [
  { href: '/admin/categories', label: '카테고리 관리' },
]

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/users', label: '회원 관리' },
  { href: '/admin/outlets', label: '매체 관리' },
]

function NavLink({ href, label, exact }: NavItem) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded text-sm transition-colors ${
        active
          ? 'bg-ink text-white font-medium'
          : 'text-ink hover:bg-line/60'
      }`}
    >
      {label}
    </Link>
  )
}

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const router = useRouter()
  const isEditor = profile?.role === 'editor' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  async function logout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-48 shrink-0 border-r border-line flex flex-col bg-paper">
      {/* 헤더 */}
      <div className="px-4 py-4 border-b border-line">
        <div className="font-semibold text-sm tracking-tight">IM CMS</div>
        {profile && (
          <div className="mt-1 text-xs text-muted truncate">{profile.full_name}</div>
        )}
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {isEditor && (
          <>
            <div className="pt-4 pb-1 px-3 text-[10px] uppercase tracking-widest text-muted/70 font-medium">
              관리
            </div>
            {EDITOR_NAV.map((item) => (
              <NavLink key={item.href} {...item} />
            ))}
          </>
        )}

        {isAdmin && ADMIN_NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* 하단 사용자 정보 */}
      <div className="p-3 border-t border-line">
        {profile && (
          <div className="mb-2.5 flex items-center gap-1.5">
            <span className={`status-badge ${
              profile.role === 'admin'   ? 'bg-ink/10 text-ink' :
              profile.role === 'editor'  ? 'bg-review/10 text-review' :
                                           'bg-draft/10 text-draft'
            }`}>
              {ROLE_LABEL[profile.role]}
            </span>
          </div>
        )}
        <button
          onClick={logout}
          className="text-xs text-muted hover:text-danger transition-colors"
        >
          로그아웃
        </button>
      </div>
    </aside>
  )
}
