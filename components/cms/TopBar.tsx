'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import { ExternalIcon, SearchIcon } from './icons'

type Props = { outletName: string | null; userName: string; role: UserRole | null }

export default function TopBar({ outletName, userName, role }: Props) {
  const router = useRouter()

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-6 border-b border-line bg-white px-6">
      <div className="min-w-0">
        {outletName ? (
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[16px] font-bold tracking-tight">{outletName}</span>
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted hover:border-ink hover:text-ink"
            >
              홈페이지 <ExternalIcon />
            </a>
          </div>
        ) : (
          <span className="rounded bg-danger/10 px-2.5 py-1 text-[12px] text-danger">
            소속 매체가 없습니다. 이 계정으로 쓴 기사는 홈페이지에 표시되지 않습니다. 관리자에게 소속 지정을 요청하세요.
          </span>
        )}
      </div>

      <form action="/articles" className="ml-auto flex w-[260px] items-center gap-2 rounded border border-line px-3 focus-within:border-ink">
        <SearchIcon />
        <label htmlFor="cms-search" className="sr-only">기사 검색</label>
        <input id="cms-search" name="q" placeholder="기사 제목 검색" className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
      </form>

      <div className="flex items-center gap-3 text-[13px]">
        <span className="font-semibold">{userName}</span>
        {role && <span className="rounded bg-line/70 px-1.5 py-0.5 text-[11px] text-muted">{ROLE_LABEL[role]}</span>}
        <button type="button" onClick={logout} className="text-[12px] text-muted hover:text-danger">
          로그아웃
        </button>
      </div>
    </header>
  )
}
