'use client'

import { useState } from 'react'
import { INDEX_INFO, INDEX_KEYS, type IndexKey, type IndexSeries } from '@/lib/market-index'

const UP = '#D03A2F' // 상승: 빨강 (국내 시세 표기 관례)
const DOWN = '#2563C9' // 하락: 파랑

const fmt = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d: string) => d.slice(5).replace('-', '.')

// 해운 운임지수 위젯: SCFI·KCCI 탭, 최근 값과 전주 대비, 12주 추이 그래프
export default function IndexWidget({ series }: { series: IndexSeries }) {
  const keys = INDEX_KEYS.filter((k) => series[k].length)
  const [active, setActive] = useState<IndexKey>(keys[0] ?? 'scfi')
  const points = series[active]
  if (!points.length) return null
  const info = INDEX_INFO[active]
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  const diff = prev ? last.value - prev.value : 0
  const pct = prev ? (diff / prev.value) * 100 : 0
  const color = diff > 0 ? UP : diff < 0 ? DOWN : '#6B7280'
  const sample = points.some((p) => p.sample)

  // 그래프 좌표 (가로 280 × 세로 96)
  const W = 280, H = 96, PAD = 6
  const vals = points.map((p) => p.value)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, points.length - 1)
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H} Z`

  return (
    <section aria-labelledby="index-widget-title" className="border border-rule bg-white">
      <div className="flex items-center justify-between border-b-2 border-brand px-4 pt-3">
        <h3 id="index-widget-title" className="pb-2.5 text-[16px] font-bold tracking-[-0.02em] text-brand">해운 운임지수</h3>
        <div role="tablist" aria-label="운임지수 고르기" className="flex">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === active}
              onClick={() => setActive(k)}
              className={`-mb-[2px] border-b-2 px-2.5 pb-2.5 text-[13px] font-semibold tabular-nums ${k === active ? 'border-gold text-brand' : 'border-transparent text-sub hover:text-brand'}`}
            >
              {INDEX_INFO[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="flex items-center gap-1.5 text-[12px] text-sub">
          {info.name}
          {sample && <span className="rounded bg-[#FFF4D6] px-1.5 text-[10.5px] font-bold text-[#8A6100]">샘플</span>}
        </p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className="text-[26px] font-extrabold leading-none tracking-[-0.02em] text-body tabular-nums">{fmt(last.value)}</p>
          {prev && (
            <p className="text-right text-[13px] font-semibold tabular-nums" style={{ color }}>
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '−'} {fmt(Math.abs(diff))}
              <span className="ml-1 text-[12px] font-medium">({pct > 0 ? '+' : ''}{pct.toFixed(2)}%)</span>
            </p>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-[#8A918C] tabular-nums">{last.date.replace(/-/g, '.')} 기준 · 전주 대비</p>

        <svg viewBox={`0 0 ${W} ${H + 16}`} className="mt-3 w-full" role="img" aria-label={`${info.label} 최근 ${points.length}주 추이: ${fmt(points[0].value)}에서 ${fmt(last.value)}`}>
          <defs>
            <linearGradient id={`ix-fill-${active}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((t) => (
            <line key={t} x1={PAD} x2={W - PAD} y1={PAD + t * (H - PAD * 2)} y2={PAD + t * (H - PAD * 2)} stroke="#E3E7E4" strokeWidth="1" strokeDasharray="2 3" />
          ))}
          <path d={area} fill={`url(#ix-fill-${active})`} />
          <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--gold)" stroke="#fff" strokeWidth="2" />
          <text x={PAD} y={H + 13} fontSize="10" fill="#8A918C">{day(points[0].date)}</text>
          <text x={W - PAD} y={H + 13} fontSize="10" fill="#8A918C" textAnchor="end">{day(last.date)}</text>
        </svg>

        <dl className="mt-2 grid grid-cols-2 gap-x-3 border-t border-rule pt-2 text-[11.5px] tabular-nums">
          <div className="flex justify-between"><dt className="text-sub">{points.length}주 최고</dt><dd className="font-semibold text-body">{fmt(max)}</dd></div>
          <div className="flex justify-between"><dt className="text-sub">{points.length}주 최저</dt><dd className="font-semibold text-body">{fmt(min)}</dd></div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-[#8A918C]">
          자료: {info.source} · {info.schedule}
          {sample && <span className="block text-[#8A6100]">시험용 샘플 값입니다. 실제 지수가 아닙니다.</span>}
        </p>
      </div>
    </section>
  )
}
