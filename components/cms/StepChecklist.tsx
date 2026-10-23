'use client'

import { useState, useTransition } from 'react'
import { setLaunchItem } from '@/app/(main)/admin/leads/actions'
import type { LaunchDone, LaunchItem } from '@/lib/launch-checklist'

// 개통 진행 현황의 한 단계에 속한 운영팀 체크 항목 (고객에게는 보이지 않는다). 체크하면 고객 화면의 단계 진행도 바뀐다
export default function StepChecklist({ outletId, items, done: initial }: { outletId: string; items: LaunchItem[]; done: LaunchDone }) {
  const [done, setDone] = useState(initial)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function toggle(key: string, on: boolean) {
    const before = done
    setDone(on ? { ...before, [key]: new Date().toISOString() } : Object.fromEntries(Object.entries(before).filter(([k]) => k !== key)))
    setError('')
    start(async () => {
      const r = await setLaunchItem(outletId, key, on)
      if (r.error) { setError(r.error); setDone(before) } else if (r.done) setDone(r.done)
    })
  }

  return (
    <div className="mt-4 rounded-xl bg-[#F8F9FA] px-3.5 py-3">
      <p className="text-[12px] font-bold text-muted">운영팀 체크 <span className="font-normal">(고객에게는 보이지 않고, 모두 체크하면 이 단계가 완료로 보입니다)</span></p>
      <ul className="mt-2 space-y-1">
        {items.map((it) => {
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
      {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}
