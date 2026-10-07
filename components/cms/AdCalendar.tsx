'use client'

import { useMemo, useState } from 'react'
import { AD_SLOTS, slotOf } from '@/lib/ads'

// 예약된 광고 (한국 날짜, 끝나는 날 포함)
export type Booking = { slot: string; start: string; end: string; advertiser: string; contractId: string | null }

const capOf = (slot: string) => (slotOf(slot)?.many ? 3 : 1)
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// 고른 자리들의 그날 상태: free(비어 있음) · some(오른쪽 자리처럼 일부 참) · full(꽉 참)
export function dayState(d: string, slots: string[], bookings: Booking[], exclude?: string | null) {
  let full = false
  let some = false
  const who: string[] = []
  for (const s of slots) {
    const on = bookings.filter((b) => b.slot === s && (!exclude || b.contractId !== exclude) && b.start <= d && b.end >= d)
    if (on.length >= capOf(s)) full = true
    else if (on.length) some = true
    for (const b of on) who.push(`${slotOf(s)?.label ?? s}: ${b.advertiser}`)
  }
  return { state: full ? 'full' : some ? 'some' : 'free', who } as const
}

// 이 기간 안에 꽉 찬 날 (자리별 첫 겹침)
export function conflicts(start: string, end: string, slots: string[], bookings: Booking[], exclude?: string | null) {
  const out: string[] = []
  if (!start || !end || end < start) return out
  for (const s of slots) {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const on = bookings.filter((b) => b.slot === s && (!exclude || b.contractId !== exclude) && b.start <= d && b.end >= d)
      if (on.length >= capOf(s)) {
        out.push(`${slotOf(s)?.label}: ${d.slice(5).replace('-', '.')}부터 ${on.map((b) => b.advertiser).join(', ')} 예약과 겹침`)
        break
      }
    }
  }
  return out
}

// 오늘부터 찾아 이 길이(일)만큼 비어 있는 가장 빠른 시작일
export function firstFree(from: string, len: number, slots: string[], bookings: Booking[], exclude?: string | null) {
  for (let i = 0; i < 730; i++) {
    const s = addDays(from, i)
    if (!conflicts(s, addDays(s, Math.max(0, len - 1)), slots, bookings, exclude).length) return s
  }
  return null
}

export default function AdCalendar({ slots, bookings, start, end, today, exclude, onChange }: {
  slots: string[]; bookings: Booking[]; start: string; end: string; today: string; exclude?: string | null
  onChange: (start: string, end: string) => void
}) {
  const first = (start || today).slice(0, 7)
  const [base, setBase] = useState(first)
  const months = [base, (() => { const [y, m] = base.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}` })()]
  const shift = (n: number) => { const [y, m] = base.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); setBase(d.toISOString().slice(0, 7)) }
  const [picking, setPicking] = useState<'start' | 'end'>('start')

  function pick(d: string) {
    if (picking === 'start' || !start || d < start) { onChange(d, end && end >= d ? end : ''); setPicking('end') }
    else { onChange(start, d); setPicking('start') }
  }

  const legendSlots = useMemo(() => slots.map((s) => AD_SLOTS.find((x) => x.id === s)?.label).filter(Boolean).join(' · '), [slots])

  return (
    <div className="rounded-md border border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="text-muted">{slots.length ? <><strong className="text-ink">{legendSlots}</strong> 예약 현황 · {picking === 'start' || !start ? '시작일을 누르세요' : '끝나는 날을 누르세요'}</> : '위에서 광고 자리를 먼저 고르세요'}</span>
        <span className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-line bg-white" />빈 날</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-[#FCE7C8]" />일부 참</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-[#F3C4C0]" />예약 있음</span>
          <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm bg-ink" />고른 기간</span>
        </span>
      </div>
      <div className="flex items-start gap-2">
        <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="mt-6 rounded border border-line px-1.5 text-[13px] hover:border-ink">‹</button>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          {months.map((ym) => {
            const [y, m] = ym.split('-').map(Number)
            const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
            const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
            return (
              <div key={ym}>
                <p className="mb-1 text-center text-[13px] font-bold">{y}년 {m}월</p>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
                <div className="mt-0.5 grid grid-cols-7 gap-0.5">
                  {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
                  {Array.from({ length: count }, (_, i) => {
                    const d = `${ym}-${String(i + 1).padStart(2, '0')}`
                    const st = slots.length ? dayState(d, slots, bookings, exclude) : { state: 'free' as const, who: [] }
                    const sel = start && (d === start || (end && d >= start && d <= end))
                    const past = d < today
                    const cls = sel
                      ? st.state === 'full' ? 'bg-danger text-white' : 'bg-ink text-white'
                      : st.state === 'full' ? 'bg-[#F3C4C0] text-[#7A1F17]' : st.state === 'some' ? 'bg-[#FCE7C8]' : 'bg-white'
                    return (
                      <button key={d} type="button" onClick={() => pick(d)} title={st.who.join('\n') || '비어 있음'}
                        className={`h-8 rounded text-[12px] tabular-nums transition hover:ring-1 hover:ring-ink ${cls} ${past && !sel ? 'opacity-40' : ''} ${d === today ? 'font-extrabold underline' : ''}`}>
                        {i + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="mt-6 rounded border border-line px-1.5 text-[13px] hover:border-ink">›</button>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">빨간 날에 마우스를 올리면 어느 광고가 잡혀 있는지 보입니다. 오른쪽 자리는 한 날에 3개까지 들어갑니다.</p>
    </div>
  )
}
