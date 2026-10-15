'use client'

import { useState, useTransition } from 'react'
import { setLaunchItem } from '@/app/(main)/admin/leads/actions'
import { LAUNCH_GROUPS, LAUNCH_KEYS, type LaunchDone } from '@/lib/launch-checklist'

export type LaunchOutlet = { id: string; name: string; domain: string | null; done: LaunchDone }

// 개설된 고객사 카드 안의 개통 체크리스트 (매체마다 따로)
export default function LaunchChecklist({ outlets, missing }: { outlets: LaunchOutlet[]; missing?: boolean }) {
  const [pick, setPick] = useState(outlets[0]?.id ?? '')
  const [doneBy, setDoneBy] = useState<Record<string, LaunchDone>>(() => Object.fromEntries(outlets.map((o) => [o.id, o.done])))
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!outlets.length) return null
  const outlet = outlets.find((o) => o.id === pick) ?? outlets[0]
  const done = doneBy[outlet.id] ?? {}
  const count = LAUNCH_KEYS.filter((k) => done[k]).length
  const pct = Math.round((count / LAUNCH_KEYS.length) * 100)
  const site = outlet.domain ? `https://${outlet.domain}` : null

  function toggle(key: string, on: boolean) {
    const before = done
    setDoneBy((m) => ({ ...m, [outlet.id]: on ? { ...before, [key]: new Date().toISOString() } : Object.fromEntries(Object.entries(before).filter(([k]) => k !== key)) }))
    setError(null)
    start(async () => {
      const r = await setLaunchItem(outlet.id, key, on)
      if (r.error) { setError(r.error); setDoneBy((m) => ({ ...m, [outlet.id]: before })) }
      else if (r.done) setDoneBy((m) => ({ ...m, [outlet.id]: r.done! }))
    })
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-[#F8F9FA]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left">
        <span className="text-[13.5px] font-bold">개통 체크리스트</span>
        <span className="h-2 w-28 overflow-hidden rounded-full bg-line" aria-hidden><span className={`block h-full rounded-full ${count === LAUNCH_KEYS.length ? 'bg-published' : 'bg-[#E8A93A]'}`} style={{ width: `${pct}%` }} /></span>
        <span className="text-[12.5px] tabular-nums text-muted">{count}/{LAUNCH_KEYS.length}{count === LAUNCH_KEYS.length ? ' · 개통 완료' : ''}</span>
        <span className="ml-auto text-[12.5px] text-muted">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-line px-4 pb-4 pt-3">
          {missing ? (
            <p className="text-[13px] text-danger">체크리스트를 쓰려면 Supabase에서 launch-checklist.sql을 실행해 주세요.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-[13px]">
                {outlets.length > 1 ? (
                  <label className="flex items-center gap-2">
                    <span className="text-muted">매체</span>
                    <select value={outlet.id} onChange={(e) => setPick(e.target.value)} className="field-input max-w-full py-1">
                      {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </label>
                ) : <strong>{outlet.name}</strong>}
                {site ? <a href={site} target="_blank" rel="noopener" className="break-all text-review underline underline-offset-2">{outlet.domain} ↗</a> : <span className="text-muted">도메인 미정</span>}
                {site && <span className="break-all text-[12px] text-muted">사이트맵 {site}/sitemap.xml · 뉴스 사이트맵 /news-sitemap.xml · RSS /rss.xml</span>}
              </div>
              {LAUNCH_GROUPS.map((g) => (
                <section key={g.title} className="mt-4">
                  <h4 className="text-[12.5px] font-bold text-muted">{g.title}</h4>
                  <ul className="mt-1.5 space-y-1">
                    {g.items.map((it) => {
                      const at = done[it.key]
                      return (
                        <li key={it.key} className="rounded-md bg-white px-3 py-2 ring-1 ring-black/5">
                          <label className="flex cursor-pointer items-start gap-2.5">
                            <input type="checkbox" checked={!!at} disabled={pending} onChange={(e) => toggle(it.key, e.target.checked)} className="mt-1 h-4 w-4 accent-published" />
                            <span className="min-w-0 flex-1">
                              <span className={`block text-[13.5px] ${at ? 'text-muted line-through' : 'font-medium'}`}>{it.title}</span>
                              {it.detail && <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{it.detail}</span>}
                            </span>
                            {at && <time className="shrink-0 text-[11.5px] tabular-nums text-muted">{new Date(at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' })}</time>}
                          </label>
                          {it.link && <a href={it.link.href} target="_blank" rel="noopener" className="ml-6 mt-1 inline-block text-[12px] text-review underline underline-offset-2">{it.link.label} 열기 ↗</a>}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
              {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
