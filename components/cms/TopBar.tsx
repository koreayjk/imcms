'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { switchOutlet } from '@/app/(main)/account/actions'
import { createClient } from '@/lib/supabase'
import { roleLabel, type UserRole } from '@/lib/types'
import { ExternalIcon, SearchIcon } from './icons'
import { useCmsLang, useT } from './CmsLang'

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
  )
}
import BrandMark from '@/components/BrandMark'
import { ViewAsPicker } from './ViewAs'
import type { ViewAs } from '@/lib/cms'

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
  // 보기 모드 고르개 (운영팀·발행인만)
  viewAsPicker?: { viewAs: ViewAs | null; staff: boolean } | null
}

export default function TopBar({ outletName, groupName, outlets = [], siteUrl = '/', currentOutletId, userName, role, isSuper, isStaff, viewAsPicker }: Props) {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  async function change(id: string) {
    if (!id || id === currentOutletId) return
    setSwitching(true)
    const { error } = await switchOutlet(id)
    setSwitching(false)
    if (error) window.alert(`${t('매체를 바꾸지 못했습니다', 'Could not switch outlets')}: ${error}`)
    router.refresh()
  }

  // 그룹별로 묶어서 보여준다 (총관리자는 여러 그룹)
  const noGroup = t('그룹 없음', 'No group')
  const groups = Array.from(new Set(outlets.map((o) => o.group ?? noGroup)))

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 min-w-0 shrink-0 items-center gap-2.5 border-b border-line bg-white px-3 print:hidden md:h-16 md:gap-6 md:px-6">
      <Link href="/newsroom" className="shrink-0 md:hidden" aria-label={t('뉴스룸 첫 화면', 'Newsroom home')}><BrandMark size={36} /></Link>
      <div className="min-w-0 flex-1 md:flex-none">
        {outlets.length > 1 ? (
          <div className="flex min-w-0 items-center gap-2.5">
            {groupName && <span className="hidden rounded bg-line/70 px-2 py-0.5 text-[11.5px] text-muted lg:inline">{groupName}</span>}
            <label htmlFor="outlet-switch" className="sr-only">{t('작업할 매체', 'Outlet to work on')}</label>
            <select
              id="outlet-switch"
              value={currentOutletId ?? ''}
              disabled={switching}
              onChange={(e) => change(e.target.value)}
              className="min-w-0 max-w-full rounded border border-line bg-white py-1.5 pl-2.5 pr-8 text-[14px] font-bold tracking-tight disabled:opacity-60 md:max-w-[260px] md:text-[15px]"
              title={t('작업할 매체 바꾸기', 'Switch outlet')}
            >
              {!currentOutletId && <option value="">{t('매체 선택', 'Select outlet')}</option>}
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {outlets.filter((o) => (o.group ?? noGroup) === g).map((o) => <option key={o.id} value={o.id}>{o.name}{o.role ? ` (${roleLabel(o.role as UserRole, lang)})` : ''}</option>)}
                </optgroup>
              ))}
            </select>
            {outletName && (
              <a href={siteUrl} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11.5px] text-muted hover:border-ink hover:text-ink md:px-2.5 md:py-0.5" aria-label={t('홈페이지 열기', 'Open homepage')}>
                <span className="hidden md:inline">{t('홈페이지', 'Homepage')}</span> <ExternalIcon />
              </a>
            )}
            {isStaff && currentOutletId && (
              <Link href={`/admin/outlets/${currentOutletId}/site`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11.5px] text-muted hover:border-ink hover:text-ink md:px-2.5 md:py-0.5" aria-label={t('이 매체의 홈페이지 설정 (운영팀)', 'Homepage settings for this outlet (IM Newsroom team)')} title={t('이 매체의 홈페이지 설정 (운영팀)', 'Homepage settings for this outlet (IM Newsroom team)')}>
                <GearIcon /> <span className="hidden md:inline">{t('설정', 'Settings')}</span>
              </Link>
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
              aria-label={t('홈페이지 열기', 'Open homepage')}
            >
              <span className="hidden md:inline">{t('홈페이지', 'Homepage')}</span> <ExternalIcon />
            </a>
            {isStaff && currentOutletId && (
              <Link href={`/admin/outlets/${currentOutletId}/site`} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2 py-1 text-[11.5px] text-muted hover:border-ink hover:text-ink md:px-2.5 md:py-0.5" aria-label={t('이 매체의 홈페이지 설정 (운영팀)', 'Homepage settings for this outlet (IM Newsroom team)')} title={t('이 매체의 홈페이지 설정 (운영팀)', 'Homepage settings for this outlet (IM Newsroom team)')}>
                <GearIcon /> <span className="hidden md:inline">{t('설정', 'Settings')}</span>
              </Link>
            )}
          </div>
        ) : isStaff ? (
          <span className="text-[15px] font-bold tracking-tight">{t('IM 뉴스룸 운영', 'IM Newsroom Operations')}</span>
        ) : (
          <span className="line-clamp-2 rounded bg-danger/10 px-2.5 py-1 text-[11.5px] text-danger md:text-[12px]">
            {t('소속 매체가 없습니다. 이 계정으로 쓴 기사는 홈페이지에 표시되지 않습니다.', 'You do not belong to an outlet. Stories written with this account will not appear on a homepage.')} {isSuper ? t('매체 메뉴에서 매체를 만들거나 고르세요.', 'Create or choose an outlet in the Outlets menu.') : t('관리자에게 소속 지정을 요청하세요.', 'Ask an administrator to assign you to an outlet.')}
          </span>
        )}
      </div>

      <form action="/articles" className="ml-auto hidden w-[260px] items-center gap-2 rounded border border-line px-3 focus-within:border-ink md:flex">
        <SearchIcon />
        <label htmlFor="cms-search" className="sr-only">{t('기사 검색', 'Search stories')}</label>
        <input id="cms-search" name="q" placeholder={t('기사 제목 검색', 'Search story titles')} className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
      </form>

      <div className="flex shrink-0 items-center gap-3 text-[13px]">
        {viewAsPicker && <ViewAsPicker viewAs={viewAsPicker.viewAs} staff={viewAsPicker.staff} />}
        <Link href="/account" className="hidden font-semibold hover:underline md:inline" title={t('내 정보·이름 바꾸기', 'My account · Edit name')}>{userName}</Link>
        {isSuper ? <span className="whitespace-nowrap rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">{t('총관리자', 'Super Admin')}</span> : isStaff ? <span className="whitespace-nowrap rounded bg-[#2F6BF0] px-1.5 py-0.5 text-[11px] font-bold text-white"><span className="hidden md:inline">{t('IM 뉴스룸 ', 'IM Newsroom ')}</span>{t('매니저', 'Manager')}</span> : role && <span className="whitespace-nowrap rounded bg-line/70 px-1.5 py-0.5 text-[11px] text-muted">{roleLabel(role, lang)}</span>}
        <button type="button" onClick={logout} className="hidden text-[12px] text-muted hover:text-danger md:inline">
          {t('로그아웃', 'Sign out')}
        </button>
      </div>
    </header>
  )
}
