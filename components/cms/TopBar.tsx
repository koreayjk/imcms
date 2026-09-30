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
  outlets?: { id: string; name: string; group: string | null }[]
  siteUrl?: string
  currentOutletId?: string | null
  userName: string
  role: UserRole | null
  isSuper?: boolean
}

export default function TopBar({ outletName, groupName, outlets = [], siteUrl = '/', currentOutletId, userName, role, isSuper }: Props) {
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
    <header className="flex h-16 shrink-0 print:hidden items-center gap-6 border-b border-line bg-white px-6">
      <div className="min-w-0">
        {outlets.length > 1 ? (
          <div className="flex items-center gap-2.5">
            {groupName && <span className="hidden rounded bg-line/70 px-2 py-0.5 text-[11.5px] text-muted lg:inline">{groupName}</span>}
            <label htmlFor="outlet-switch" className="sr-only">작업할 매체</label>
            <select
              id="outlet-switch"
              value={currentOutletId ?? ''}
              disabled={switching}
              onChange={(e) => change(e.target.value)}
              className="max-w-[260px] rounded border border-line bg-white py-1.5 pl-2.5 pr-8 text-[15px] font-bold tracking-tight disabled:opacity-60"
              title="작업할 매체 바꾸기"
            >
              {!currentOutletId && <option value="">매체 선택</option>}
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {outlets.filter((o) => (o.group ?? '그룹 없음') === g).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </optgroup>
              ))}
            </select>
            {outletName && (
              <a href={siteUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted hover:border-ink hover:text-ink">
                홈페이지 <ExternalIcon />
              </a>
            )}
          </div>
        ) : outletName ? (
          <div className="flex items-center gap-2.5">
            <span className="truncate text-[16px] font-bold tracking-tight">{outletName}</span>
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-[11.5px] text-muted hover:border-ink hover:text-ink"
            >
              홈페이지 <ExternalIcon />
            </a>
          </div>
        ) : (
          <span className="rounded bg-danger/10 px-2.5 py-1 text-[12px] text-danger">
            소속 매체가 없습니다. 이 계정으로 쓴 기사는 홈페이지에 표시되지 않습니다. {isSuper ? '매체 메뉴에서 매체를 만들거나 고르세요.' : '관리자에게 소속 지정을 요청하세요.'}
          </span>
        )}
      </div>

      <form action="/articles" className="ml-auto flex w-[260px] items-center gap-2 rounded border border-line px-3 focus-within:border-ink">
        <SearchIcon />
        <label htmlFor="cms-search" className="sr-only">기사 검색</label>
        <input id="cms-search" name="q" placeholder="기사 제목 검색" className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
      </form>

      <div className="flex items-center gap-3 text-[13px]">
        <Link href="/account" className="font-semibold hover:underline" title="내 정보·이름 바꾸기">{userName}</Link>
        {isSuper ? <span className="rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">총관리자</span> : role && <span className="rounded bg-line/70 px-1.5 py-0.5 text-[11px] text-muted">{ROLE_LABEL[role]}</span>}
        <button type="button" onClick={logout} className="text-[12px] text-muted hover:text-danger">
          로그아웃
        </button>
      </div>
    </header>
  )
}
