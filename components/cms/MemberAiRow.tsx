'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveMemberLimit } from '@/app/(main)/admin/settings/actions'
import { roleLabel, type UserRole } from '@/lib/types'
import { useCmsLang, useT } from './CmsLang'

export type MemberAi = { profile_id: string; full_name: string | null; role: string; drafts: number; legal_checks: number; custom_limit: number | null; effective_limit: number | null }

// 기자 한 줄: 이번 달 AI 사용 횟수(초안 + 법적 검수), 한도(빈 칸 = 자동 배분)
export default function MemberAiRow({ m, editable }: { m: MemberAi; editable: boolean }) {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [value, setValue] = useState(m.custom_limit == null ? '' : String(m.custom_limit))
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()
  const lim = m.effective_limit
  const used = m.drafts + m.legal_checks
  const pct = lim ? Math.min(100, (used / lim) * 100) : 0
  const dirty = value !== (m.custom_limit == null ? '' : String(m.custom_limit))
  return (
    <li className="grid gap-2 px-5 py-3.5 md:grid-cols-[1.2fr_1.6fr_1.4fr] md:items-center">
      <p className="min-w-0 truncate text-[14px] font-semibold">{m.full_name ?? t('(이름 없음)', '(no name)')} <span className="text-[12px] font-normal text-muted">{roleLabel(m.role as UserRole, lang)}</span></p>
      <div>
        <p className="flex flex-wrap justify-between gap-x-2 text-[12.5px] tabular-nums">
          <span>{t('AI 사용', 'AI used')} <strong className="text-[14px]">{used}</strong>{lim != null ? t(` / ${lim}회`, ` / ${lim}`) : t('회 · 한도 없음', ' · no limit')}</span>
          <span className="text-muted">{t('초안', 'Drafts')} {m.drafts} · {t('법적 검수', 'Legal checks')} {m.legal_checks}</span>
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line/70" aria-hidden>
          <div className={`h-full ${lim != null && used >= lim ? 'bg-danger' : lim != null && used >= lim * 0.8 ? 'bg-draft' : 'bg-published'}`} style={{ width: `${lim == null ? 0 : pct}%` }} />
        </div>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 text-[13px] md:justify-end">
          <label className="flex items-center gap-1.5">
            <span className="whitespace-nowrap text-muted">{t('월 한도', 'Monthly limit')}</span>
            <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={m.custom_limit == null && lim != null ? t(`자동 ${lim}`, `Auto ${lim}`) : t('자동', 'Auto')} className="field-input py-1.5 text-right tabular-nums" style={{ width: 90 }} aria-label={t(`${m.full_name ?? ''} 월 AI 사용 한도 (비우면 자동 배분)`, `${m.full_name ?? ''} monthly AI usage limit (leave blank to allocate automatically)`)} />
          </label>
          <button type="button" disabled={!dirty || pending} onClick={() => start(async () => { const r = await saveMemberLimit(m.profile_id, value); setMsg(r.error ?? ''); if (!r.error) router.refresh() })} className="btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{pending ? '…' : t('저장', 'Save')}</button>
          {m.custom_limit != null && <button type="button" disabled={pending} onClick={() => start(async () => { setValue(''); const r = await saveMemberLimit(m.profile_id, ''); setMsg(r.error ?? ''); router.refresh() })} className="text-[12px] text-muted underline">{t('자동으로', 'Set to auto')}</button>}
          {msg && <span role="alert" className="w-full text-right text-[12px] text-danger">{msg}</span>}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted md:text-right">{m.custom_limit != null ? t('편집장이 정한 한도', 'Limit set by the Editor-in-Chief') : t('매체 한도를 인원수로 나눈 값', 'Outlet limit divided by headcount')}</p>
      )}
    </li>
  )
}
