'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSchedule, saveSchedule, skipNextSchedule, toggleSchedule, type NlState, type ScheduleInput } from '@/app/(main)/admin/newsletter/actions'
import { KIND_LABEL, WEEKDAYS, describeSchedule, formatKst, perMonthOf, type NewsletterSchedule, type ScheduleKind } from '@/lib/newsletter-schedule'
import { newsletterLabel, type NewsletterQuota } from '@/lib/pricing'

type Section = { slug: string; name: string }

const EMPTY: ScheduleInput = { kind: 'weekly', weekday: 1, month_day: 1, send_on: null, hour: 7, article_count: 5, section_slug: null, subject_template: '{매체} {날짜} 주요 뉴스', intro: '' }
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const hourLabel = (h: number) => `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시`

export default function NewsletterSchedules({ schedules, sections, quota, sqlMissing, subscribed }: {
  schedules: NewsletterSchedule[]; sections: Section[]; quota: NewsletterQuota | null; sqlMissing: boolean; subscribed: number
}) {
  const router = useRouter()
  const [form, setForm] = useState<ScheduleInput | null>(null)
  const [msg, setMsg] = useState<NlState>({})
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<NlState>, after?: () => void) => start(async () => { const r = await fn(); setMsg(r); if (!r.error) { after?.(); router.refresh() } })
  const set = (patch: Partial<ScheduleInput>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const planned = schedules.filter((s) => s.enabled && s.kind !== 'once').reduce((n, s) => n + perMonthOf(s.kind), 0)
  const sectionName = (slug: string | null) => (slug ? sections.find((s) => s.slug === slug)?.name ?? slug : '전체 섹션')
  const minDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

  return (
    <section aria-labelledby="nl-auto" className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 id="nl-auto" className="text-[15px] font-bold">자동 발송 예약</h2>
        {quota && !sqlMissing && !form && (
          <button type="button" onClick={() => { setForm({ ...EMPTY }); setMsg({}) }} className="btn-secondary">+ 예약 추가</button>
        )}
      </div>
      <div className="space-y-3 px-5 py-4 text-[13.5px]">
        <p className="text-[12.5px] leading-relaxed text-muted">
          정해 둔 날에 <b className="text-ink">지난 뉴스레터 뒤에 발행된 최근 기사</b>를 골라 그때의 구독자 전원에게 보냅니다. 새로 구독한 독자도 자동으로 받고, 새 기사가 없으면 그 회차는 건너뜁니다.
          보내기 하루 전에 편집장·발행인에게 안내 메일이 가며, 여기서 <b className="text-ink">이번 회차 건너뛰기</b>를 누를 수 있습니다.
        </p>
        {sqlMissing ? (
          <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3">자동 발송을 쓰려면 Supabase에서 <code>supabase/newsletter-schedule.sql</code>을 먼저 실행해 주세요.</p>
        ) : !quota ? (
          <p className="rounded-lg border border-line px-4 py-3">자동 발송은 스탠다드 요금제부터 쓸 수 있습니다.</p>
        ) : (
          <p className="text-[12.5px] text-muted">
            요금제 한도 {newsletterLabel(quota)} (월 {quota.perMonth}회) · 켜 둔 반복 예약 <b className={planned > quota.perMonth ? 'text-danger' : 'text-ink'}>한 달 최대 {planned}회</b>
            {subscribed > quota.perSend && <b className="ml-1 text-danger">· 구독자가 회당 한도({quota.perSend.toLocaleString()}명)보다 많아 자동 발송이 멈춥니다</b>}
          </p>
        )}

        {schedules.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {schedules.map((s) => (
              <li key={s.id} className="space-y-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s.enabled ? 'bg-published/10 text-published' : 'bg-line text-muted'}`}>{s.enabled ? '켜짐' : '꺼짐'}</span>
                  <b className="text-[14px]">{describeSchedule(s)}</b>
                  <span className="text-muted">최근 기사 {s.article_count}개 · {sectionName(s.section_slug)}</span>
                </div>
                <p className="text-[12.5px] text-muted">
                  제목: {s.subject_template}
                  {s.enabled && s.next_run_at && <> · 다음 발송 <b className="text-ink">{formatKst(s.next_run_at)}</b></>}
                </p>
                {s.last_result && <p className="text-[12.5px] text-muted">최근 결과: {s.last_result}{s.last_run_at ? ` (${formatKst(s.last_run_at)})` : ''}</p>}
                <div className="flex flex-wrap gap-3 pt-1 text-[12.5px]">
                  {s.enabled && s.next_run_at && (
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(`${formatKst(s.next_run_at!)} 회차를 건너뛸까요?`)) run(() => skipNextSchedule(s.id)) }} className="underline">이번 회차 건너뛰기</button>
                  )}
                  <button type="button" disabled={pending} onClick={() => run(() => toggleSchedule(s.id, !s.enabled))} className="underline">{s.enabled ? '멈추기' : '다시 켜기'}</button>
                  <button type="button" disabled={pending} onClick={() => { setForm({ ...s, intro: s.intro ?? '' }); setMsg({}) }} className="underline">고치기</button>
                  <button type="button" disabled={pending} onClick={() => { if (window.confirm('이 예약을 지울까요?')) run(() => deleteSchedule(s.id)) }} className="text-danger underline">지우기</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!schedules.length && !sqlMissing && quota && !form && <p className="text-[13px] text-muted">아직 예약이 없습니다. ‘예약 추가’로 매주·2주마다·매월 또는 원하는 날짜를 정해 두세요.</p>}

        {form && (
          <form
            onSubmit={(e) => { e.preventDefault(); run(() => saveSchedule(form), () => setForm(null)) }}
            className="space-y-3 rounded-lg border border-line bg-paper/40 p-4"
          >
            <fieldset>
              <legend className="field-label">언제 보낼까요</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as ScheduleKind[]).map((k) => (
                  <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] ${form.kind === k ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
                    <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => set({ kind: k })} className="sr-only" />
                    {KIND_LABEL[k]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              {form.kind === 'once' && (
                <label className="block text-[13px]">
                  <span className="field-label">날짜</span>
                  <input type="date" required min={minDate} value={form.send_on ?? ''} onChange={(e) => set({ send_on: e.target.value })} className="field-input" />
                </label>
              )}
              {(form.kind === 'weekly' || form.kind === 'biweekly') && (
                <label className="block text-[13px]">
                  <span className="field-label">요일</span>
                  <select value={form.weekday ?? 1} onChange={(e) => set({ weekday: Number(e.target.value) })} className="field-input">
                    {WEEKDAYS.map((w, i) => <option key={w} value={i}>{w}요일</option>)}
                  </select>
                </label>
              )}
              {form.kind === 'monthly' && (
                <label className="block text-[13px]">
                  <span className="field-label">날짜</span>
                  <select value={form.month_day ?? 1} onChange={(e) => set({ month_day: Number(e.target.value) })} className="field-input">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>매월 {d}일</option>)}
                  </select>
                </label>
              )}
              <label className="block text-[13px]">
                <span className="field-label">시각 (한국 시간)</span>
                <select value={form.hour} onChange={(e) => set({ hour: Number(e.target.value) })} className="field-input">
                  {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select>
              </label>
              <label className="block text-[13px]">
                <span className="field-label">넣을 기사 수</span>
                <select value={form.article_count} onChange={(e) => set({ article_count: Number(e.target.value) })} className="field-input">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>최근 {n}개</option>)}
                </select>
              </label>
              <label className="block text-[13px]">
                <span className="field-label">섹션</span>
                <select value={form.section_slug ?? ''} onChange={(e) => set({ section_slug: e.target.value || null })} className="field-input">
                  <option value="">전체 섹션</option>
                  {sections.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </label>
            </div>
            {form.kind === 'biweekly' && <p className="text-[12px] text-muted">첫 발송은 고른 요일 중 가장 가까운 날이고, 그 뒤 2주마다 나갑니다.</p>}
            <label className="block text-[13px]">
              <span className="field-label">제목 <span className="font-normal text-muted">· {'{매체}'} 는 매체 이름, {'{날짜}'} 는 보내는 날(예: 10월 20일)로 바뀝니다</span></span>
              <input value={form.subject_template} onChange={(e) => set({ subject_template: e.target.value })} maxLength={150} required className="field-input" />
            </label>
            <label className="block text-[13px]">
              <span className="field-label">머리말 (선택 · 매번 같은 글이 들어갑니다)</span>
              <textarea value={form.intro ?? ''} onChange={(e) => set({ intro: e.target.value })} rows={2} maxLength={3000} className="field-input resize-y" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending} className="btn-publish px-5">{pending ? '저장 중…' : form.id ? '고친 내용 저장' : '예약 저장'}</button>
              <button type="button" disabled={pending} onClick={() => setForm(null)} className="btn-secondary">취소</button>
            </div>
          </form>
        )}
        {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`text-[13.5px] font-semibold ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}
      </div>
    </section>
  )
}
