'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setOutletPlan, type PlanState } from '@/app/(main)/admin/ai-usage/actions'
import { PLANS } from '@/lib/pricing'
import { useT, useCmsLang } from './CmsLang'

const PLAN_NAME_EN: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium', enterprise: 'Enterprise' }

export type PlanRowData = {
  id: string; name: string; group: string | null
  plan: string | null; customLimit: number | null; limit: number | null; overage: boolean
  used: number; overCount: number; costWon: number; extraWon: number
}

// 매체 한 줄: 요금제·한도·추가 사용을 고르고, 이번 달 사용량을 막대로 보여준다
export default function PlanRow({ row }: { row: PlanRowData }) {
  const t = useT()
  const lang = useCmsLang()
  const loc = lang === 'en' ? 'en-US' : 'ko-KR'
  const router = useRouter()
  const [plan, setPlan] = useState(row.plan ?? '')
  const [limit, setLimit] = useState(row.customLimit == null ? '' : String(row.customLimit))
  const [overage, setOverage] = useState(row.overage)
  const [msg, setMsg] = useState<PlanState>({})
  const [pending, start] = useTransition()
  const dirty = plan !== (row.plan ?? '') || limit !== (row.customLimit == null ? '' : String(row.customLimit)) || overage !== row.overage
  const pct = row.limit ? Math.min(100, (row.used / row.limit) * 100) : 0
  const tone = row.limit == null ? 'bg-line' : row.used >= row.limit ? 'bg-danger' : row.used >= row.limit * 0.8 ? 'bg-draft' : 'bg-published'

  return (
    <li className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1.4fr_2fr_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-[14.5px] font-semibold">{row.name}</p>
        {row.group && <p className="truncate text-[12px] text-muted">{row.group}</p>}
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[12.5px] tabular-nums">
          <span><strong className="text-[15px]">{row.used.toLocaleString(loc)}</strong>{row.limit != null ? ` / ${row.limit.toLocaleString(loc)}${lang === 'en' ? '' : '건'}` : lang === 'en' ? ' · No limit' : '건 · 한도 없음'}</span>
          {row.overCount > 0 && <span className="font-semibold text-danger">{lang === 'en' ? `${row.overCount.toLocaleString(loc)} over` : `추가 ${row.overCount.toLocaleString()}건`}</span>}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/70" aria-hidden><div className={`h-full ${tone}`} style={{ width: `${row.limit == null ? 0 : pct}%` }} /></div>
        <p className="mt-1 text-[11.5px] tabular-nums text-muted">
          {lang === 'en'
            ? <>AI cost approx. KRW {row.costWon.toLocaleString(loc)}{row.extraWon > 0 && <> · Extra charge KRW {row.extraWon.toLocaleString(loc)}</>}</>
            : <>AI 원가 약 {row.costWon.toLocaleString()}원{row.extraWon > 0 && <> · 추가 청구 {row.extraWon.toLocaleString()}원</>}</>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <label className="sr-only" htmlFor={`plan-${row.id}`}>{lang === 'en' ? `${row.name} plan` : `${row.name} 요금제`}</label>
        <select id={`plan-${row.id}`} value={plan} onChange={(e) => setPlan(e.target.value)} className="field-input py-1.5" style={{ width: 'auto', maxWidth: 200 }}>
          <option value="">{t('요금제 없음 (한도 없음)', 'No plan (no limit)')}</option>
          {PLANS.map((p) => <option key={p.id} value={p.id}>{lang === 'en' ? PLAN_NAME_EN[p.id] ?? p.name : p.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5">
          <span className="whitespace-nowrap text-muted">{t('한도', 'Limit')}</span>
          <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={t('기본값', 'Default')} className="field-input py-1.5 text-right tabular-nums" style={{ width: 84 }} aria-label={t(`${row.name} 월 한도 (비우면 요금제 기본값)`, `${row.name} monthly limit (leave blank for the plan default)`)} />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={overage} onChange={(e) => setOverage(e.target.checked)} className="h-4 w-4" />
          <span>{t('넘어도 계속(추가 청구)', 'Continue past limit (extra charge)')}</span>
        </label>
      </div>

      <div className="flex items-center gap-2 md:justify-end">
        {(msg.error || msg.ok) && <span role={msg.error ? 'alert' : 'status'} className={`text-[12px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</span>}
        <button
          type="button"
          disabled={!dirty || pending}
          onClick={() => start(async () => { const r = await setOutletPlan(row.id, { plan, limit, overage }); setMsg(r); if (!r.error) router.refresh() })}
          className="btn-primary px-4 py-1.5 text-[13px] disabled:opacity-40"
        >
          {pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
        </button>
      </div>
    </li>
  )
}
