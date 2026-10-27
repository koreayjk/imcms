'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setViewAs } from '@/app/(main)/account/view-as'
import type { ViewAs } from '@/lib/cms'
import { useT } from './CmsLang'

const LABEL: Record<'ko' | 'en', Record<ViewAs, string>> = {
  ko: { group: '발행인', editor: '편집장', reporter: '기자' },
  en: { group: 'Publisher', editor: 'Editor-in-Chief', reporter: 'Reporter' },
}

// 상단 "보기" 고르개: 내 화면 / 발행인(운영팀만) / 편집장 / 기자 화면으로 바꿔 본다 (화면 구성만 바뀐다)
export function ViewAsPicker({ viewAs, staff }: { viewAs: ViewAs | null; staff: boolean }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <label className="hidden items-center gap-1.5 text-[12px] text-muted md:flex" title={t('편집장·기자는 화면이 어떻게 다른지 미리 봅니다. 화면 구성만 바뀌고 실제 권한은 그대로입니다.', 'Preview how the Editor-in-Chief and Reporter screens differ. Only the layout changes; your actual permissions stay the same.')}>
      {t('보기', 'View')}
      <select
        value={viewAs ?? 'off'}
        disabled={pending}
        onChange={(e) => start(async () => {
          const r = await setViewAs(e.target.value as 'off' | ViewAs)
          if (r.error) { setError(r.error); return }
          router.push('/newsroom'); router.refresh()
        })}
        className="rounded border border-line bg-white px-1.5 py-1 text-[12px] text-ink"
      >
        <option value="off">{t('내 화면', 'My view')}</option>
        {staff && <option value="group">{t('발행인 화면', 'Publisher view')}</option>}
        <option value="editor">{t('편집장 화면', 'Editor-in-Chief view')}</option>
        <option value="reporter">{t('기자 화면', 'Reporter view')}</option>
      </select>
      {error && <span role="alert" className="text-danger">{error}</span>}
    </label>
  )
}

// 보기 모드 중에 맨 위에 보이는 띠
export default function ViewAsBar({ viewAs }: { viewAs: ViewAs }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#B7791F]/30 bg-[#FFF4D6] px-4 py-1.5 text-[12.5px] text-[#7A4B00] print:hidden">
      <strong>{t(`${LABEL.ko[viewAs]} 화면으로 보는 중`, `Viewing as ${LABEL.en[viewAs]}`)}</strong>
      <span>{t('메뉴와 버튼 구성만 바뀝니다. 실제 권한은 내 계정 그대로입니다.', 'Only the menus and buttons change. Your actual permissions stay the same as your own account.')}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await setViewAs('off'); router.push('/newsroom'); router.refresh() })}
        className="ml-auto rounded bg-[#7A4B00] px-3 py-1 font-semibold text-white disabled:opacity-60"
      >
        {t('내 화면으로 돌아가기', 'Back to my view')}
      </button>
    </div>
  )
}
