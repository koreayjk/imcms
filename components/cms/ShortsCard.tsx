'use client'

import { useState, useTransition } from 'react'
import { lookupYoutubeChannel } from '@/app/(main)/admin/settings/youtube-actions'
import { useT } from '@/components/cms/CmsLang'
import type { ShortsSettings } from '@/lib/sites'

// 설정 화면의 "쇼츠 구역" 입력 (홈페이지에 유튜브 쇼츠를 자동으로 보여 준다)
export default function ShortsCard({ value, onChange }: { value?: ShortsSettings; onChange: (v: ShortsSettings | undefined) => void }) {
  const t = useT()
  const [url, setUrl] = useState('')
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const cur: ShortsSettings = value ?? { on: false, channelId: '' }
  const put = (patch: Partial<ShortsSettings>) => {
    const next = { ...cur, ...patch }
    // 채널 ID가 비면 저장할 값이 없다
    onChange(next.channelId.trim() ? next : undefined)
  }
  const find = () => start(async () => {
    const r = await lookupYoutubeChannel(url)
    if (r.error) { setMsg({ error: r.error }); return }
    put({ channelId: r.channelId })
    setMsg({ ok: t(`채널을 찾았습니다${r.name ? `: ${r.name}` : ''}`, `Channel found${r.name ? `: ${r.name}` : ''}`) })
  })
  const idOk = /^UC[\w-]{22}$/.test(cur.channelId.trim())
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-[13.5px] font-semibold">
        <input type="checkbox" checked={cur.on} disabled={!cur.channelId.trim()} onChange={(e) => put({ on: e.target.checked })} />
        {t('홈페이지에 쇼츠 구역 보이기', 'Show the Shorts section on the home page')}
      </label>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://www.youtube.com/@채널이름" className="field-input" aria-label={t('유튜브 채널 주소', 'YouTube channel link')} />
        <button type="button" onClick={find} disabled={pending || !url.trim()} className="btn-secondary disabled:opacity-50">{pending ? t('찾는 중…', 'Looking…') : t('채널 ID 찾기', 'Find channel ID')}</button>
      </div>
      {msg.error && <p className="text-[12.5px] font-semibold text-danger">{msg.error}</p>}
      {msg.ok && <p className="text-[12.5px] font-semibold text-published">{msg.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-[12.5px]"><span className="mb-1 block font-semibold">{t('채널 ID', 'Channel ID')}</span>
          <input value={cur.channelId} maxLength={30} onChange={(e) => put({ channelId: e.target.value })} placeholder="UC…" className="field-input" />
        </label>
        <label className="block text-[12.5px]"><span className="mb-1 block font-semibold">{t('구역 제목', 'Section title')}</span>
          <input value={cur.title ?? ''} maxLength={20} onChange={(e) => put({ title: e.target.value })} placeholder={t('쇼츠', 'Shorts')} className="field-input" />
        </label>
        <label className="block text-[12.5px]"><span className="mb-1 block font-semibold">{t('보여 줄 개수', 'How many')}</span>
          <select value={cur.count ?? 6} onChange={(e) => put({ count: Number(e.target.value) })} className="field-input">
            {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => <option key={n} value={n}>{t(`${n}개`, String(n))}</option>)}
          </select>
        </label>
      </div>
      {cur.channelId.trim() && !idOk && <p className="text-[12.5px] font-semibold text-danger">{t('채널 ID는 UC로 시작하는 24글자입니다. 저장할 때 이 값은 빠집니다.', 'A channel ID is 24 characters starting with UC. It will be dropped on save.')}</p>}
    </div>
  )
}
