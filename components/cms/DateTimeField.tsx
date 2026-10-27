'use client'

import type { CSSProperties } from 'react'
import { useCmsLang } from './CmsLang'

// 날짜·시각 입력: 한국어는 브라우저 기본 입력칸, English 는 브라우저 언어와 상관없이 영어로 보이는 고르개
//   (브라우저의 날짜 입력칸은 브라우저 언어를 따라 "연도. 월. 일."로 나와서, 영어 화면에서는 직접 만든다)
//   값은 datetime-local 과 같은 "YYYY-MM-DDTHH:mm" 문자열 (비어 있으면 "")
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export default function DateTimeField({ id, value, onChange, className = 'field-input', style, title }: {
  id?: string; value: string; onChange: (v: string) => void; className?: string; style?: CSSProperties; title?: string
}) {
  const lang = useCmsLang()
  if (lang !== 'en') {
    return <input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} title={title} className={className} style={style} />
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  const now = new Date()
  const y = m ? Number(m[1]) : now.getFullYear()
  const mo = m ? Number(m[2]) : now.getMonth() + 1
  const d = m ? Number(m[3]) : now.getDate()
  const h24 = m ? Number(m[4]) : 9
  const mi = m ? Number(m[5]) : 0
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const pm = h24 >= 12
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 1 + i)
  if (m && !years.includes(y)) years.push(y)
  const daysIn = new Date(y, mo, 0).getDate()
  const set = (p: Partial<{ y: number; mo: number; d: number; h12: number; mi: number; pm: boolean }>) => {
    const ny = p.y ?? y, nmo = p.mo ?? mo, nh12 = p.h12 ?? h12, nmi = p.mi ?? mi, npm = p.pm ?? pm
    const nd = Math.min(p.d ?? d, new Date(ny, nmo, 0).getDate())
    const nh = (nh12 % 12) + (npm ? 12 : 0)
    onChange(`${ny}-${pad(nmo)}-${pad(nd)}T${pad(nh)}:${pad(nmi)}`)
  }
  const sel = 'field-input w-auto py-1.5 pr-7'
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={title} role="group" aria-label="Date and time">
      <select id={id} value={mo} onChange={(e) => set({ mo: Number(e.target.value) })} className={sel} aria-label="Month">
        {MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select value={Math.min(d, daysIn)} onChange={(e) => set({ d: Number(e.target.value) })} className={sel} aria-label="Day">
        {Array.from({ length: daysIn }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select value={y} onChange={(e) => set({ y: Number(e.target.value) })} className={sel} aria-label="Year">
        {years.sort().map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span aria-hidden className="text-muted">·</span>
      <select value={h12} onChange={(e) => set({ h12: Number(e.target.value) })} className={sel} aria-label="Hour">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select value={mi} onChange={(e) => set({ mi: Number(e.target.value) })} className={sel} aria-label="Minute">
        {Array.from({ length: 60 }, (_, i) => i).map((n) => <option key={n} value={n}>{pad(n)}</option>)}
      </select>
      <select value={pm ? 'pm' : 'am'} onChange={(e) => set({ pm: e.target.value === 'pm' })} className={sel} aria-label="AM or PM">
        <option value="am">AM</option>
        <option value="pm">PM</option>
      </select>
    </span>
  )
}
