'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveMemberLimit } from '@/app/(main)/admin/settings/actions'

export type MemberAi = { profile_id: string; full_name: string | null; role: string; drafts: number; legal_checks: number; custom_limit: number | null; effective_limit: number | null }

const ROLE: Record<string, string> = { reporter: '기자', editor: '편집장', admin: '발행인' }

// 기자 한 줄: 이번 달 AI 초안·법적 검수 횟수, 한도(빈 칸 = 자동 배분)
export default function MemberAiRow({ m, editable }: { m: MemberAi; editable: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(m.custom_limit == null ? '' : String(m.custom_limit))
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()
  const lim = m.effective_limit
  const pct = lim ? Math.min(100, (m.drafts / lim) * 100) : 0
  const dirty = value !== (m.custom_limit == null ? '' : String(m.custom_limit))
  return (
    <li className="grid gap-2 px-5 py-3.5 md:grid-cols-[1.2fr_1.6fr_1.4fr] md:items-center">
      <p className="min-w-0 truncate text-[14px] font-semibold">{m.full_name ?? '(이름 없음)'} <span className="text-[12px] font-normal text-muted">{ROLE[m.role] ?? m.role}</span></p>
      <div>
        <p className="flex justify-between text-[12.5px] tabular-nums">
          <span>AI 초안 <strong className="text-[14px]">{m.drafts}</strong>{lim != null ? ` / ${lim}건` : '건 · 한도 없음'}</span>
          <span className="text-muted">법적 검수 {m.legal_checks}회</span>
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/70" aria-hidden>
          <div className={`h-full ${lim != null && m.drafts >= lim ? 'bg-danger' : lim != null && m.drafts >= lim * 0.8 ? 'bg-draft' : 'bg-published'}`} style={{ width: `${lim == null ? 0 : pct}%` }} />
        </div>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] md:justify-end">
          <label className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-muted">월 한도</span>
            <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={m.custom_limit == null && lim != null ? `자동 ${lim}` : '자동'} className="field-input py-1.5 text-right tabular-nums" style={{ width: 90 }} aria-label={`${m.full_name ?? ''} 월 AI 초안 한도 (비우면 자동 배분)`} />
          </label>
          <button type="button" disabled={!dirty || pending} onClick={() => start(async () => { const r = await saveMemberLimit(m.profile_id, value); setMsg(r.error ?? ''); if (!r.error) router.refresh() })} className="btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{pending ? '…' : '저장'}</button>
          {m.custom_limit != null && <button type="button" disabled={pending} onClick={() => start(async () => { setValue(''); const r = await saveMemberLimit(m.profile_id, ''); setMsg(r.error ?? ''); router.refresh() })} className="text-[12px] text-muted underline">자동으로</button>}
          {msg && <span role="alert" className="w-full text-right text-[12px] text-danger">{msg}</span>}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted md:text-right">{m.custom_limit != null ? '편집장이 정한 한도' : '매체 한도를 인원수로 나눈 값'}</p>
      )}
    </li>
  )
}
