'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAdSlotSettings } from '@/app/(main)/admin/ads/actions'
import { AD_SLOTS } from '@/lib/ads'
import type { AdSlotSettings as Settings } from '@/lib/ad-slot-settings'
import { SLOT_COLOR, SLOT_NO } from './AdSlotMap'

// 광고 자리 설정 (편집장 이상): 안 쓰는 자리는 끄고, 오른쪽에 동시에 보일 광고 개수를 정한다
export default function AdSlotSettings({ outletId, initial }: { outletId: string; initial?: Settings }) {
  const router = useRouter()
  const [off, setOff] = useState<string[]>(initial?.off ?? [])
  const [max, setMax] = useState<number>(initial?.sidebarMax ?? 3)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const toggle = (id: string) => setOff((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  const save = () => start(async () => {
    const r = await saveAdSlotSettings(outletId, { off, sidebarMax: max })
    setMsg(r)
    if (!r.error) router.refresh()
  })
  return (
    <section aria-labelledby="slot-settings-title" className="rounded-xl border border-line bg-white p-5">
      <h2 id="slot-settings-title" className="text-[15px] font-bold">광고 자리 설정</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">쓰지 않는 자리는 꺼 두세요. 꺼진 자리는 홈페이지에 나오지 않고 빈 공간도 생기지 않습니다. 걸어 둔 배너는 그대로 남아 있다가 다시 켜면 나갑니다.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {AD_SLOTS.map((s) => {
          const on = !off.includes(s.id)
          return (
            <li key={s.id} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${on ? 'border-line' : 'border-line bg-[#F8F9FA]'}`}>
              <input id={`slot-on-${s.id}`} type="checkbox" checked={on} onChange={() => toggle(s.id)} className="mt-1" />
              <label htmlFor={`slot-on-${s.id}`} className="min-w-0 flex-1 text-[13px]">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="grid h-4.5 w-4.5 place-items-center rounded px-1 text-[10.5px] text-white" style={{ background: SLOT_COLOR[s.id] }}>{SLOT_NO[s.id]}</span>
                  {s.label} <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${on ? 'bg-published/10 text-published' : 'bg-line text-muted'}`}>{on ? '켜짐' : '꺼짐'}</span>
                </span>
                <span className="mt-0.5 block text-[12px] text-muted">{s.where}</span>
                {s.id === 'sidebar' && on && (
                  <span className="mt-1.5 flex items-center gap-2 text-[12.5px]">동시에 보일 광고
                    <select value={max} onChange={(e) => setMax(Number(e.target.value))} className="field-input w-24 py-1">
                      <option value={1}>1개</option><option value={2}>2개</option><option value={3}>3개</option>
                    </select>
                    <span className="text-muted">순서는 배너의 “순서 번호”(작을수록 위)로 정합니다</span>
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn-primary px-5">{pending ? '저장 중…' : '자리 설정 저장'}</button>
        {msg.ok && <p role="status" className="text-[13px] text-published">{msg.ok}</p>}
        {msg.error && <p role="alert" className="text-[13px] text-danger">{msg.error}</p>}
      </div>
    </section>
  )
}
