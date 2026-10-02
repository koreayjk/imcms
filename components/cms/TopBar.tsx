'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { switchOutlet } from '@/app/(main)/account/actions'
import { createClient } from '@/lib/supabase'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import { ExternalIcon, SearchIcon } from './icons'

type Props = {
  outletName: string | null
  groupName?: string | null
  outlets?: { id: string; name: string; group: string | null; role?: string | null }[]
  siteUrl?: string
  currentOutletId?: string | null
  userName: string
  role: UserRole | null
  isSuper?: boolean
  isStaff?: boolean
}

export default function TopBar({ outletName, groupName, outlets = [], siteUrl = '/', currentOutletId, userName, role, isSuper, isStaff }: Props) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  async function change(id: string) {
    if (!id || id === currentOutletId) return
    setSwitching(true)
    const { error } = await switchOutlet(id)
    setSwitching(false)
    if (error) window.alert(`매체를 바꾸지 못했습니다: ${error}`)
    router.refresh()
  }

  // 그룹별로 묶어서 보여준다 (총관리자는 여러 그룹)
  const groups = Array.from(new Set(outlets.map((o) => o.group ?? '그룹 없음')))

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3 print:hidden md:h-16 md:gap-6 md:px-6">
      <Link href="/newsroom" className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#1C1F26] text-[11px] font-extrabold text-white md:hidden" aria-label="뉴스룸 첫 화면">IM</Link>
      <div className="min-w-0 flex-1 md:flex-none">
        {outlets.length > 1 ? (
          <div className="flex min-w-0 items-center gap-2.5">
            {groupName && <span className="hidden rounded bg-line/70 px-2 py-0.5 text-[11.5px] text-muted lg:inline">{groupName}</span>}
            <label htmlFor="outlet-switch" className="sr-only">작업할 매체</label>
            <select
              id="outlet-switch"
              value={currentOutletId ?? ''}
              disabled={switching}
              onChange={(e) => change(e.target.value)}
              className="min-w-0 max-w-full rounded border border-line bg-white py-1.5 pl-2.5 pr-8 text-[14px] font-bold tracking-tight disabled:opacity-60 md:max-w-[260px] md:text-[15px]"
              title="작업할 매체 바꾸기"
            >
              {!currentOutletId && <option value="">매체 선택</option>}
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {outlets.filter((o) => (o.group ?? '그룹 없음') === g).map((o) => <option key={o.id} value={o.id}>{o.name}{o.role ? ` (${ROLE_LABEL[o.role as UserRole] ?? o.role})` : ''}</option>)}
                </optgroup>
              ))}
            </select>
            {outletName && (
              <a href={siteUrl} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11.5px] text-muted hover:border-ink hover:text-ink md:px-2.5 md:py-0.5" aria-label="홈페이지 열기">
                <span className="hidden md:inline">홈페이지</span> <ExternalIcon />
              </a>
            )}
          </div>
        ) : outletName ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-[15px] font-bold tracking-tight md:text-[16px]">{outletName}</span>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11.5px] text-muted hover:border-ink hover:text-ink md:px-2.5 md:py-0.5"
              aria-label="홈페이지 열기"
            >
              <span className="hidden md:inline">홈페이지</span> <ExternalIcon />
            </a>
          </div>
        ) : isStaff ? (
          <span className="text-[15px] font-bold tracking-tight">IM 뉴스룸 운영</span>
        ) : (
          <span className="line-clamp-2 rounded bg-danger/10 px-2.5 py-1 text-[11.5px] text-danger md:text-[12px]">
            소속 매체가 없습니다. 이 계정으로 쓴 기사는 홈페이지에 표시되지 않습니다. {isSuper ? '매체 메뉴에서 매체를 만들거나 고르세요.' : '관리자에게 소속 지정을 요청하세요.'}
          </span>
        )}
      </div>

      <form action="/articles" className="ml-auto hidden w-[260px] items-center gap-2 rounded border border-line px-3 focus-within:border-ink md:flex">
        <SearchIcon />
        <label htmlFor="cms-search" className="sr-only">기사 검색</label>
        <input id="cms-search" name="q" placeholder="기사 제목 검색" className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
      </form>

      <div className="flex shrink-0 items-center gap-3 text-[13px]">
        <Link href="/account" className="hidden font-semibold hover:underline md:inline" title="내 정보·이름 바꾸기">{userName}</Link>
        {isSuper ? <span className="whitespace-nowrap rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">총관리자</span> : isStaff ? <span className="whitespace-nowrap rounded bg-[#2F6BF0] px-1.5 py-0.5 text-[11px] font-bold text-white"><span className="hidden md:inline">IM 뉴스룸 </span>매니저</span> : role && <span className="whitespace-nowrap rounded bg-line/70 px-1.5 py-0.5 text-[11px] text-muted">{ROLE_LABEL[role]}</span>}
        <button type="button" onClick={logout} className="hidden text-[12px] text-muted hover:text-danger md:inline">
          로그아웃
        </button>
      </div>
    </header>
  )
}
