'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import { openCustomer, saveLead, type LeadState } from '@/app/(main)/admin/leads/actions'
import PendingButton from './PendingButton'

export type Lead = {
  id: string; company: string; contact_name: string; phone: string; email: string | null; outlet_count: string | null
  current_cms: string | null; message: string | null; status: string; created_at: string
  note?: string | null; assigned_to?: string | null; publisher_id?: string | null
}

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: '새 신청', cls: 'bg-danger text-white' },
  contacted: { label: '상담 중', cls: 'bg-review/10 text-review' },
  done: { label: '완료', cls: 'bg-line text-muted' },
}

export default function LeadCard({ lead, staff, createdLabel, groupName }: { lead: Lead; staff: { id: string; name: string }[]; createdLabel: string; groupName: string | null }) {
  const router = useRouter()
  const [status, setStatus] = useState(lead.status)
  const [note, setNote] = useState(lead.note ?? '')
  const [assignee, setAssignee] = useState(lead.assigned_to ?? '')
  const [msg, setMsg] = useState<LeadState>({})
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [openState, openAction] = useFormState<LeadState, FormData>(openCustomer.bind(null, lead.id), {})
  const dirty = status !== lead.status || note !== (lead.note ?? '') || assignee !== (lead.assigned_to ?? '')

  return (
    <li className={`rounded-xl border bg-white px-6 py-5 ${lead.status === 'new' ? 'border-danger/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${STATUS[lead.status]?.cls}`}>{STATUS[lead.status]?.label ?? lead.status}</span>
        <strong className="text-[16px]">{lead.company}</strong>
        {lead.outlet_count && <span className="text-[13px] text-muted">매체 {lead.outlet_count}</span>}
        {groupName && <span className="rounded bg-published/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-published">개설됨 · {groupName}</span>}
        <time className="ml-auto text-[12.5px] tabular-nums text-muted">{createdLabel}</time>
      </div>
      <p className="mt-2 text-[14px]">
        {lead.contact_name} · <a href={`tel:${lead.phone}`} className="underline underline-offset-2">{lead.phone}</a>
        {lead.email && <> · <a href={`mailto:${lead.email}`} className="underline underline-offset-2">{lead.email}</a></>}
        {lead.current_cms && <span className="text-muted"> · 사용 중: {lead.current_cms}</span>}
      </p>
      {lead.message && <p className="mt-2 whitespace-pre-line rounded bg-paper px-4 py-3 text-[13.5px] leading-relaxed">{lead.message}</p>}

      {/* 처리: 담당·상태·상담 기록 */}
      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[160px_140px_1fr_auto] sm:items-start">
        <label className="text-[12.5px]">
          <span className="field-label">담당 매니저</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="field-input py-1.5">
            <option value="">미지정</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-[12.5px]">
          <span className="field-label">상태</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input py-1.5">
            <option value="new">새 신청</option><option value="contacted">상담 중</option><option value="done">완료</option>
          </select>
        </label>
        <label className="text-[12.5px]">
          <span className="field-label">상담 기록</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="예) 10/2 통화 — 매체 3개, 11월 오픈 희망. 견적 안내함" className="field-input resize-y py-1.5 text-[13px]" />
        </label>
        <div className="flex flex-col gap-1.5 pt-5">
          <button type="button" disabled={!dirty || pending} onClick={() => start(async () => { const r = await saveLead(lead.id, { status, note, assignedTo: assignee || null }); setMsg(r); if (!r.error) router.refresh() })} className="btn-primary px-4 py-1.5 text-[13px] disabled:opacity-40">
            {pending ? '저장 중…' : '저장'}
          </button>
          {!lead.publisher_id && <button type="button" onClick={() => setOpen(!open)} className="btn-publish px-4 py-1.5 text-[13px]">고객사 개설</button>}
        </div>
      </div>
      {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`mt-2 text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}

      {open && (
        <form action={openAction} className="mt-4 rounded-lg border border-published/30 bg-published/5 p-4">
          <p className="text-[13.5px] font-bold">고객사 개설 — 새 그룹 + 첫 매체 + 발행인 초대를 한 번에</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[12.5px]"><span className="field-label">그룹 이름</span><input name="group_name" defaultValue={lead.company} required className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">첫 매체 이름</span><input name="outlet_name" defaultValue={lead.company} required className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">도메인 (선택)</span><input name="domain" placeholder="예: seniornews.co.kr" className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">발행인 이름</span><input name="full_name" defaultValue={lead.contact_name} className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px] sm:col-span-2"><span className="field-label">발행인 이메일 (이 주소로 가입하면 바로 발행인)</span><input name="email" type="email" defaultValue={lead.email ?? ''} required className="field-input bg-white py-1.5" /></label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <PendingButton pending="개설 중…" className="btn-publish px-5">개설하기</PendingButton>
            {openState.error && <p role="alert" className="text-[12.5px] text-danger">{openState.error}</p>}
            {openState.ok && <p role="status" className="text-[12.5px] text-published">{openState.ok}</p>}
          </div>
        </form>
      )}
    </li>
  )
}
