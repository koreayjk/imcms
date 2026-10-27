'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteLead, openCustomer, saveLead, sendLeadMail, type LeadState } from '@/app/(main)/admin/leads/actions'
import { leadMailTemplates } from '@/lib/lead-mail'
import PendingButton from './PendingButton'
import { BILLING_LABEL, planById, won, type Billing } from '@/lib/pricing'
import { useT, useCmsLang } from '@/components/cms/CmsLang'
import type { T } from '@/lib/cms-i18n'

export type Lead = {
  id: string; company: string; contact_name: string; phone: string; email: string | null; outlet_count: string | null
  current_cms: string | null; message: string | null; status: string; created_at: string
  note?: string | null; assigned_to?: string | null; publisher_id?: string | null
  plan?: string | null; billing?: string | null; domain?: string | null; quoted_total?: number | null
  beta_discount?: boolean | null; terms_agreed_at?: string | null; terms_version?: string | null
}

const statusInfo = (t: T): Record<string, { label: string; cls: string }> => ({
  new: { label: t('새 신청', 'New request'), cls: 'bg-danger text-white' },
  contacted: { label: t('상담 중', 'In consultation'), cls: 'bg-review/10 text-review' },
  done: { label: t('완료', 'Done'), cls: 'bg-line text-muted' },
})
// 영어 화면용: 요금제·결제 방식 이름, 금액
const PLAN_EN: Record<string, string> = { basic: 'Basic', standard: 'Standard', premium: 'Premium', enterprise: 'Enterprise' }
const BILLING_EN: Record<string, string> = { monthly: 'Monthly billing', annual: 'Annual billing' }

// 개설된 고객사의 매체: 개통 진행 현황 링크 (진행률 %)
export type LaunchLink = { id: string; name: string; pct: number }

export default function LeadCard({ lead, staff, createdLabel, groupName, launch, canDelete }: { lead: Lead; staff: { id: string; name: string }[]; createdLabel: string; groupName: string | null; launch?: LaunchLink[]; canDelete?: boolean }) {
  const t = useT()
  const lang = useCmsLang()
  const STATUS = statusInfo(t)
  const router = useRouter()
  const [status, setStatus] = useState(lead.status)
  const [note, setNote] = useState(lead.note ?? '')
  const [assignee, setAssignee] = useState(lead.assigned_to ?? '')
  const [msg, setMsg] = useState<LeadState>({})
  const [open, setOpen] = useState(false)
  const [mailOpen, setMailOpen] = useState(false)
  const [tpl, setTpl] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [mailMsg, setMailMsg] = useState<LeadState>({})
  const [copyMe, setCopyMe] = useState(true)
  const [sending, startSend] = useTransition()
  const templates = leadMailTemplates(lead)
  const [pending, start] = useTransition()
  const [openState, openAction] = useActionState<LeadState, FormData>(openCustomer.bind(null, lead.id), {})
  const dirty = status !== lead.status || note !== (lead.note ?? '') || assignee !== (lead.assigned_to ?? '')

  return (
    <li className={`rounded-xl border bg-white px-4 py-5 sm:px-6 ${lead.status === 'new' ? 'border-danger/40' : 'border-line'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${STATUS[lead.status]?.cls}`}>{STATUS[lead.status]?.label ?? lead.status}</span>
        <strong className="text-[16px]">{lead.company}</strong>
        {lead.outlet_count && <span className="text-[13px] text-muted">{t('매체', 'Outlets')} {lead.outlet_count}</span>}
        {planById(lead.plan) && (
          <span className="rounded bg-[#FFF4F1] px-2 py-0.5 text-[12px] font-semibold text-[#C2410C]">
            {lang === 'en' ? (PLAN_EN[planById(lead.plan)!.id] ?? planById(lead.plan)!.name) : planById(lead.plan)!.name}{lead.billing ? ` · ${lang === 'en' ? (BILLING_EN[lead.billing] ?? lead.billing) : (BILLING_LABEL[lead.billing as Billing] ?? lead.billing)}` : ''}{lead.beta_discount ? t(' · 베타 반값', ' · Beta half price') : ''}
            {lead.quoted_total != null && <span className="tabular-nums"> · {t('첫 결제', 'First payment')} {lang === 'en' ? `KRW ${Math.round(lead.quoted_total).toLocaleString('en-US')}` : won(lead.quoted_total)}</span>}
          </span>
        )}
        {groupName && <span className="rounded bg-published/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-published">{t('개설됨', 'Opened')} · {groupName}</span>}
        <time className="ml-auto text-[12.5px] tabular-nums text-muted">{createdLabel}</time>
      </div>
      <p className="mt-2 break-words text-[14px]">
        {lead.contact_name} · <a href={`tel:${lead.phone}`} className="underline underline-offset-2">{lead.phone}</a>
        {lead.email && <> · <a href={`mailto:${lead.email}`} className="underline underline-offset-2">{lead.email}</a></>}
        {lead.current_cms && <span className="text-muted"> · {t('사용 중', 'Currently using')}: {lead.current_cms}</span>}
        {lead.domain && <span className="text-muted"> · {t('도메인', 'Domain')}: {lead.domain}</span>}
      </p>
      {lead.terms_agreed_at && <p className="mt-1 text-[12px] text-muted">{t(`이용약관(${lead.terms_version}) · 개인정보 수집·이용 동의함`, `Agreed to the Terms of Service (${lead.terms_version}) and the collection and use of personal information`)}</p>}
      {lead.message && <p className="mt-2 whitespace-pre-line rounded bg-paper px-4 py-3 text-[13.5px] leading-relaxed">{lead.message}</p>}

      {/* 처리: 담당·상태·상담 기록 */}
      <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[160px_140px_1fr_auto] sm:items-start">
        <label className="text-[12.5px]">
          <span className="field-label">{t('담당 매니저', 'Assigned manager')}</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="field-input py-1.5">
            <option value="">{t('미지정', 'Unassigned')}</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-[12.5px]">
          <span className="field-label">{t('상태', 'Status')}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input py-1.5">
            <option value="new">{STATUS.new.label}</option><option value="contacted">{STATUS.contacted.label}</option><option value="done">{STATUS.done.label}</option>
          </select>
        </label>
        <label className="text-[12.5px]">
          <span className="field-label">{t('상담 기록', 'Consultation notes')}</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('예) 10/2 통화 — 매체 3개, 11월 오픈 희망. 견적 안내함', 'e.g. Call on 10/2 — 3 outlets, wants to launch in November. Quote sent')} className="field-input resize-y py-1.5 text-[13px]" />
        </label>
        <div className="flex flex-col gap-1.5 pt-5">
          <button type="button" disabled={!dirty || pending} onClick={() => start(async () => { const r = await saveLead(lead.id, { status, note, assignedTo: assignee || null }); setMsg(r); if (!r.error) router.refresh() })} className="btn-primary px-4 py-1.5 text-[13px] disabled:opacity-40">
            {pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
          </button>
          {lead.status !== 'done' && !lead.publisher_id && (
            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await saveLead(lead.id, { status: 'done', note, assignedTo: assignee || null }); setMsg(r); if (!r.error) { setStatus('done'); router.refresh() } })} className="btn-secondary px-4 py-1.5 text-[13px]" title={t('확인을 마쳤으면 완료로 넘깁니다. 개설 이후 절차는 개통 현황에서 합니다', 'When you have checked everything, move it to Done. Steps after opening are handled under Launch status')}>{t('확인하고 완료', 'Confirm and complete')}</button>
          )}
          {lead.email && <button type="button" onClick={() => setMailOpen(!mailOpen)} className="btn-secondary px-4 py-1.5 text-[13px]">{t('메일 보내기', 'Send email')}</button>}
          {!lead.publisher_id && <button type="button" onClick={() => setOpen(!open)} className="btn-publish px-4 py-1.5 text-[13px]">{t('고객사 개설', 'Open client')}</button>}
          {canDelete && (
            <button type="button" disabled={pending} onClick={() => {
              if (!window.confirm(t(`“${lead.company}” 신청 기록을 지울까요?\n\n되돌릴 수 없습니다.${lead.publisher_id ? '\n이미 개설한 그룹·매체와 계정은 지워지지 않습니다.' : ''}`, `Delete the request record for “${lead.company}”?\n\nThis cannot be undone.${lead.publisher_id ? '\nThe group, outlets and accounts already opened will not be deleted.' : ''}`))) return
              start(async () => { const r = await deleteLead(lead.id); setMsg(r); if (!r.error) router.refresh() })
            }} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-danger">{t('삭제', 'Delete')}</button>
          )}
        </div>
      </div>
      {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`mt-2 text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}

      {mailOpen && lead.email && (
        <div className="mt-4 rounded-lg border border-line bg-paper p-4">
          <p className="text-[13.5px] font-bold">{t(`${lead.email} 로 안내 메일 보내기`, `Send an email to ${lead.email}`)}</p>
          <p className="mt-0.5 text-[12px] text-muted">{t('보내는 이름은 “IM 뉴스룸”, 답장은 문의 주소로 옵니다. 보낸 기록은 상담 기록에 남습니다.', 'The sender name is “IM Newsroom”, and replies go to the contact address. A record of the email is added to the consultation notes.')}</p>
          <label className="mt-3 block text-[12.5px]">
            <span className="field-label">{t('문안 불러오기', 'Load a template')}</span>
            <select value={tpl} onChange={(e) => { const tp = templates.find((x) => x.key === e.target.value); setTpl(e.target.value); if (tp) { setSubject(tp.subject); setBody(tp.body) } }} className="field-input bg-white py-1.5">
              <option value="">{t('직접 쓰기', 'Write my own')}</option>
              {templates.map((tp) => <option key={tp.key} value={tp.key}>{tp.label}</option>)}
            </select>
          </label>
          <label className="mt-3 block text-[12.5px]"><span className="field-label">{t('제목', 'Subject')}</span><input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="field-input bg-white py-1.5" /></label>
          <label className="mt-3 block text-[12.5px]"><span className="field-label">{t('내용', 'Message')}</span><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} maxLength={8000} className="field-input resize-y bg-white py-1.5 text-[13px] leading-relaxed" /></label>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px]"><input type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} className="h-4 w-4 accent-[#1D3461]" />{t('나에게도 사본 보내기', 'Send a copy to me')} <span className="text-muted">{t('(내 로그인 이메일로 같은 메일이 한 통 더 갑니다)', '(the same email is also sent to my login email)')}</span></label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" disabled={sending || !subject.trim() || !body.trim()} onClick={() => { if (!confirm(t(`${lead.email} 로 메일을 보낼까요?`, `Send the email to ${lead.email}?`))) return; startSend(async () => { const r = await sendLeadMail(lead.id, { subject, body, copyMe }); setMailMsg(r); if (!r.error) { if (r.note != null) setNote(r.note); if (r.status) setStatus(r.status); router.refresh() } }) }} className="btn-primary px-5 py-1.5 text-[13px] disabled:opacity-40">
              {sending ? t('보내는 중…', 'Sending…') : t('보내기', 'Send')}
            </button>
            {(mailMsg.error || mailMsg.ok) && <p role={mailMsg.error ? 'alert' : 'status'} className={`text-[12.5px] ${mailMsg.error ? 'text-danger' : 'text-published'}`}>{mailMsg.error ?? mailMsg.ok}</p>}
          </div>
        </div>
      )}

      {/* 개설된 고객사: 이후 절차(도메인·법정 표기·검색 등록·고객 코멘트)는 개통 현황에서 한다 */}
      {lead.publisher_id && launch && launch.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-[#F8F9FA] px-4 py-3 text-[13px]">
          <span className="font-bold">{t('개통 현황', 'Launch status')}</span>
          {launch.map((o) => (
            <a key={o.id} href={`/admin/onboarding/${o.id}`} className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-black/10 hover:ring-ink">{o.name} · {o.pct}% →</a>
          ))}
          <span className="text-[12px] text-muted">{t('체크 항목과 고객 코멘트는 개통 현황에서 다룹니다.', 'Checklist items and client comments are handled under Launch status.')}</span>
        </div>
      )}

      {open && (
        <form action={openAction} className="mt-4 rounded-lg border border-published/30 bg-published/5 p-4">
          <p className="text-[13.5px] font-bold">{t('고객사 개설 — 새 그룹 + 첫 매체 + 발행인 초대를 한 번에', 'Open client — create a new group, the first outlet and a publisher invitation in one step')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-[12.5px]"><span className="field-label">{t('그룹 이름', 'Group name')}</span><input name="group_name" defaultValue={lead.company} required className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">{t('첫 매체 이름', 'First outlet name')}</span><input name="outlet_name" defaultValue={lead.company} required className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">{t('도메인 (선택)', 'Domain (optional)')}</span><input name="domain" placeholder={t('예: seniornews.co.kr', 'e.g. seniornews.co.kr')} className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px]"><span className="field-label">{t('발행인 이름', 'Publisher name')}</span><input name="full_name" defaultValue={lead.contact_name} className="field-input bg-white py-1.5" /></label>
            <label className="text-[12.5px] sm:col-span-2"><span className="field-label">{t('발행인 이메일 (이 주소로 가입하면 바로 발행인)', 'Publisher email (signing up with this address makes them Publisher right away)')}</span><input name="email" type="email" defaultValue={lead.email ?? ''} required className="field-input bg-white py-1.5" /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <PendingButton pending={t('개설 중…', 'Opening…')} className="btn-publish px-5">{t('개설하기', 'Open client')}</PendingButton>
            {openState.error && <p role="alert" className="text-[12.5px] text-danger">{openState.error}</p>}
            {openState.ok && <p role="status" className="text-[12.5px] text-published">{openState.ok}</p>}
          </div>
        </form>
      )}
    </li>
  )
}
