'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteSchedule, saveSchedule, skipNextSchedule, toggleSchedule, type NlState, type ScheduleInput } from '@/app/(main)/admin/newsletter/actions'
import { KIND_LABEL, describeSchedule, formatKst, hourName, kindLabel, perMonthOf, quotaLabel, weekdayName, type NewsletterSchedule, type ScheduleKind } from '@/lib/newsletter-schedule'
import type { NewsletterQuota } from '@/lib/pricing'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

type Section = { slug: string; name: string }

const EMPTY: ScheduleInput = { kind: 'weekly', weekday: 1, month_day: 1, send_on: null, hour: 7, article_count: 5, section_slug: null, subject_template: '{매체} {날짜} 주요 뉴스', intro: '' }
const EMPTY_EN: ScheduleInput = { ...EMPTY, subject_template: '{outlet} {date} Top Stories' }
const HOURS = Array.from({ length: 24 }, (_, h) => h)

export default function NewsletterSchedules({ schedules, sections, quota, sqlMissing, subscribed }: {
  schedules: NewsletterSchedule[]; sections: Section[]; quota: NewsletterQuota | null; sqlMissing: boolean; subscribed: number
}) {
  const t = useT()
  const lang = useCmsLang()
  const ql = (q: NewsletterQuota | null) => quotaLabel(q, lang)
  const router = useRouter()
  const [form, setForm] = useState<ScheduleInput | null>(null)
  const [msg, setMsg] = useState<NlState>({})
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<NlState>, after?: () => void) => start(async () => { const r = await fn(); setMsg(r); if (!r.error) { after?.(); router.refresh() } })
  const set = (patch: Partial<ScheduleInput>) => setForm((f) => (f ? { ...f, ...patch } : f))
  const planned = schedules.filter((s) => s.enabled && s.kind !== 'once').reduce((n, s) => n + perMonthOf(s.kind), 0)
  const sectionName = (slug: string | null) => (slug ? sections.find((s) => s.slug === slug)?.name ?? slug : t('전체 섹션', 'All sections'))
  const minDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())

  return (
    <section aria-labelledby="nl-auto" className="rounded-xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <h2 id="nl-auto" className="text-[15px] font-bold">{t('자동 발송 예약', 'Scheduled sends')}</h2>
        {quota && !sqlMissing && !form && (
          <button type="button" onClick={() => { setForm({ ...(lang === 'en' ? EMPTY_EN : EMPTY) }); setMsg({}) }} className="btn-secondary">{t('+ 예약 추가', '+ Add schedule')}</button>
        )}
      </div>
      <div className="space-y-3 px-5 py-4 text-[13.5px]">
        <p className="text-[12.5px] leading-relaxed text-muted">
          {t('정해 둔 날에', 'On the scheduled day, the')} <b className="text-ink">{t('지난 뉴스레터 뒤에 발행된 최근 기사', 'most recent stories published since the last newsletter')}</b>{t('를 골라 그때의 구독자 전원에게 보냅니다. 새로 구독한 독자도 자동으로 받고, 새 기사가 없으면 그 회차는 건너뜁니다.', ' are picked and sent to all subscribers at that time. Newly subscribed readers receive it automatically, and if there are no new stories, that send is skipped.')}
          {t('보내기 하루 전에 편집장·발행인에게 안내 메일이 가며, 여기서', 'A day before sending, the Editor-in-Chief and Publisher get a heads-up email, and you can click')} <b className="text-ink">{t('이번 회차 건너뛰기', 'Skip this send')}</b>{t('를 누를 수 있습니다.', ' here.')}
        </p>
        {sqlMissing ? (
          <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3">{t('자동 발송을 쓰려면 Supabase에서', 'To use scheduled sending, first run')} <code>supabase/newsletter-schedule.sql</code>{t('을 먼저 실행해 주세요.', ' in Supabase.')}</p>
        ) : !quota ? (
          <p className="rounded-lg border border-line px-4 py-3">{t('자동 발송은 스탠다드 요금제부터 쓸 수 있습니다.', 'Scheduled sending is available from the Standard plan.')}</p>
        ) : (
          <p className="text-[12.5px] text-muted">
            {t('요금제 한도', 'Plan limit')} {ql(quota)} ({t(`월 ${quota.perMonth}회`, `${quota.perMonth} per month`)}) · {t('켜 둔 반복 예약', 'Active recurring schedules:')} <b className={planned > quota.perMonth ? 'text-danger' : 'text-ink'}>{t(`한 달 최대 ${planned}회`, `up to ${planned} per month`)}</b>
            {subscribed > quota.perSend && <b className="ml-1 text-danger">· {t(`구독자가 회당 한도(${quota.perSend.toLocaleString()}명)보다 많아 자동 발송이 멈춥니다`, `you have more subscribers than the per-send limit (${quota.perSend.toLocaleString('en-US')}), so scheduled sending stops`)}</b>}
          </p>
        )}

        {schedules.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {schedules.map((s) => (
              <li key={s.id} className="space-y-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s.enabled ? 'bg-published/10 text-published' : 'bg-line text-muted'}`}>{s.enabled ? t('켜짐', 'On') : t('꺼짐', 'Off')}</span>
                  <b className="text-[14px]">{describeSchedule(s, lang)}</b>
                  <span className="text-muted">{t(`최근 기사 ${s.article_count}개`, `Latest ${s.article_count} ${s.article_count === 1 ? 'story' : 'stories'}`)} · {sectionName(s.section_slug)}</span>
                </div>
                <p className="text-[12.5px] text-muted">
                  {t('제목', 'Subject')}: {s.subject_template}
                  {s.enabled && s.next_run_at && <> · {t('다음 발송', 'Next send')} <b className="text-ink">{formatKst(s.next_run_at, lang)}{lang === 'en' ? ' KST' : ''}</b></>}
                </p>
                {s.last_result && <p className="text-[12.5px] text-muted">{t('최근 결과', 'Last result')}: {s.last_result}{s.last_run_at ? ` (${formatKst(s.last_run_at, lang)}${lang === 'en' ? ' KST' : ''})` : ''}</p>}
                <div className="flex flex-wrap gap-3 pt-1 text-[12.5px]">
                  {s.enabled && s.next_run_at && (
                    <button type="button" disabled={pending} onClick={() => { if (window.confirm(t(`${formatKst(s.next_run_at!)} 회차를 건너뛸까요?`, `Skip the ${formatKst(s.next_run_at!, 'en')} KST send?`))) run(() => skipNextSchedule(s.id)) }} className="underline">{t('이번 회차 건너뛰기', 'Skip this send')}</button>
                  )}
                  <button type="button" disabled={pending} onClick={() => run(() => toggleSchedule(s.id, !s.enabled))} className="underline">{s.enabled ? t('멈추기', 'Pause') : t('다시 켜기', 'Turn back on')}</button>
                  <button type="button" disabled={pending} onClick={() => { setForm({ ...s, intro: s.intro ?? '' }); setMsg({}) }} className="underline">{t('고치기', 'Edit')}</button>
                  <button type="button" disabled={pending} onClick={() => { if (window.confirm(t('이 예약을 지울까요?', 'Delete this schedule?'))) run(() => deleteSchedule(s.id)) }} className="text-danger underline">{t('지우기', 'Delete')}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!schedules.length && !sqlMissing && quota && !form && <p className="text-[13px] text-muted">{t('아직 예약이 없습니다. ‘예약 추가’로 매주·2주마다·매월 또는 원하는 날짜를 정해 두세요.', 'No schedules yet. Use “Add schedule” to set a weekly, every-2-weeks or monthly send, or pick a specific date.')}</p>}

        {form && (
          <form
            onSubmit={(e) => { e.preventDefault(); run(() => saveSchedule(form), () => setForm(null)) }}
            className="space-y-3 rounded-lg border border-line bg-paper/40 p-4"
          >
            <fieldset>
              <legend className="field-label">{t('언제 보낼까요', 'When should it be sent?')}</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as ScheduleKind[]).map((k) => (
                  <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] ${form.kind === k ? 'border-ink bg-ink text-white' : 'border-line bg-white'}`}>
                    <input type="radio" name="kind" value={k} checked={form.kind === k} onChange={() => set({ kind: k })} className="sr-only" />
                    {kindLabel(k, lang)}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap gap-3">
              {form.kind === 'once' && (
                <label className="block text-[13px]">
                  <span className="field-label">{t('날짜', 'Date')}</span>
                  <input type="date" required min={minDate} value={form.send_on ?? ''} onChange={(e) => set({ send_on: e.target.value })} className="field-input" />
                </label>
              )}
              {(form.kind === 'weekly' || form.kind === 'biweekly') && (
                <label className="block text-[13px]">
                  <span className="field-label">{t('요일', 'Day of week')}</span>
                  <select value={form.weekday ?? 1} onChange={(e) => set({ weekday: Number(e.target.value) })} className="field-input">
                    {Array.from({ length: 7 }, (_, i) => <option key={i} value={i}>{weekdayName(i, lang)}</option>)}
                  </select>
                </label>
              )}
              {form.kind === 'monthly' && (
                <label className="block text-[13px]">
                  <span className="field-label">{t('날짜', 'Date')}</span>
                  <select value={form.month_day ?? 1} onChange={(e) => set({ month_day: Number(e.target.value) })} className="field-input">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{t(`매월 ${d}일`, `Day ${d} of every month`)}</option>)}
                  </select>
                </label>
              )}
              <label className="block text-[13px]">
                <span className="field-label">{t('시각 (한국 시간)', 'Time (Korea time)')}</span>
                <select value={form.hour} onChange={(e) => set({ hour: Number(e.target.value) })} className="field-input">
                  {HOURS.map((h) => <option key={h} value={h}>{hourName(h, lang)}</option>)}
                </select>
              </label>
              <label className="block text-[13px]">
                <span className="field-label">{t('넣을 기사 수', 'Number of stories')}</span>
                <select value={form.article_count} onChange={(e) => set({ article_count: Number(e.target.value) })} className="field-input">
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{t(`최근 ${n}개`, `Latest ${n}`)}</option>)}
                </select>
              </label>
              <label className="block text-[13px]">
                <span className="field-label">{t('섹션', 'Section')}</span>
                <select value={form.section_slug ?? ''} onChange={(e) => set({ section_slug: e.target.value || null })} className="field-input">
                  <option value="">{t('전체 섹션', 'All sections')}</option>
                  {sections.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
                </select>
              </label>
            </div>
            {form.kind === 'biweekly' && <p className="text-[12px] text-muted">{t('첫 발송은 고른 요일 중 가장 가까운 날이고, 그 뒤 2주마다 나갑니다.', 'The first send is on the nearest chosen weekday, then every 2 weeks after that.')}</p>}
            <label className="block text-[13px]">
              <span className="field-label">{t('제목', 'Subject')} <span className="font-normal text-muted">· {lang === 'en' ? '{outlet} becomes the outlet name and {date} becomes the send date (e.g. Oct 20)' : <>{'{매체}'} 는 매체 이름, {'{날짜}'} 는 보내는 날(예: 10월 20일)로 바뀝니다</>}</span></span>
              <input value={form.subject_template} onChange={(e) => set({ subject_template: e.target.value })} maxLength={150} required className="field-input" />
            </label>
            <label className="block text-[13px]">
              <span className="field-label">{t('머리말 (선택 · 매번 같은 글이 들어갑니다)', 'Intro (optional · the same text is included every time)')}</span>
              <textarea value={form.intro ?? ''} onChange={(e) => set({ intro: e.target.value })} rows={2} maxLength={3000} className="field-input resize-y" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending} className="btn-publish px-5">{pending ? t('저장 중…', 'Saving…') : form.id ? t('고친 내용 저장', 'Save changes') : t('예약 저장', 'Save schedule')}</button>
              <button type="button" disabled={pending} onClick={() => setForm(null)} className="btn-secondary">{t('취소', 'Cancel')}</button>
            </div>
          </form>
        )}
        {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`text-[13.5px] font-semibold ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}
      </div>
    </section>
  )
}
