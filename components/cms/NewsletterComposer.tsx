'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { addSubscribers, previewNewsletter, removeSubscriber, sendNewsletter, sendTestNewsletter, type NlState } from '@/app/(main)/admin/newsletter/actions'
import { formatDate, formatDateTime } from '@/lib/format'
import type { NewsletterQuota } from '@/lib/pricing'
import { quotaLabel } from '@/lib/newsletter-schedule'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

type Art = { id: string; title: string; published_at: string | null; category: string | null }
type Sub = { id: string; email: string; status: string; source: string; created_at: string }
type Camp = { id: string; subject: string; recipient_count: number; failed_count: number; sent_at: string }

const SUB_STATUS = { ko: { subscribed: '구독 중', pending: '확인 대기', unsubscribed: '수신거부' }, en: { subscribed: 'Subscribed', pending: 'Pending confirmation', unsubscribed: 'Unsubscribed' } } as const

export default function NewsletterComposer({ outletName, articles, counts, subscribers, campaigns, quota, usedThisMonth, mailOn, children }: {
  outletName: string; articles: Art[]; counts: { subscribed: number; pending: number; unsubscribed: number }
  subscribers: Sub[]; campaigns: Camp[]; quota: NewsletterQuota | null; usedThisMonth: number; mailOn: boolean; children?: ReactNode
}) {
  const t = useT()
  const lang = useCmsLang()
  const ql = (q: NewsletterQuota | null) => quotaLabel(q, lang)
  const left = quota ? Math.max(0, quota.perMonth - usedThisMonth) : 0
  const overPerSend = !!quota && counts.subscribed > quota.perSend
  const router = useRouter()
  const today = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date())
  const [subject, setSubject] = useState(t(`${outletName} ${today} 주요 뉴스`, `${outletName} ${today} Top Stories`))
  const [intro, setIntro] = useState('')
  const [picked, setPicked] = useState<string[]>(articles.slice(0, 5).map((a) => a.id))
  const [preview, setPreview] = useState('')
  const [msg, setMsg] = useState<NlState>({})
  const [pending, start] = useTransition()
  const [paste, setPaste] = useState('')
  const [consent, setConsent] = useState(false)

  const draft = () => ({ subject, intro, articleIds: picked })
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 15 ? p : [...p, id]))
  const run = (fn: () => Promise<NlState>, refresh = false) => start(async () => { const r = await fn(); setMsg(r); if (refresh && !r.error) router.refresh() })

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3 text-center">
        {([[t('구독 중', 'Subscribed'), counts.subscribed, 'text-published'], [t('확인 대기', 'Pending confirmation'), counts.pending, 'text-muted'], [t('수신거부', 'Unsubscribed'), counts.unsubscribed, 'text-muted']] as const).map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-line bg-white px-3 py-4">
            <dt className="text-[12.5px] text-muted">{k}</dt>
            <dd className={`mt-1 text-[26px] font-bold tabular-nums ${c}`}>{v.toLocaleString(lang === 'en' ? 'en-US' : undefined)}</dd>
          </div>
        ))}
      </dl>

      {!mailOn && <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-3 text-[13.5px]">{t('메일 발송이 아직 설정되지 않았습니다. 설정되면 홈페이지 아래에 구독 신청 칸이 생기고, 여기서 보낼 수 있습니다.', 'Email sending is not set up yet. Once it is, a subscription box appears at the bottom of your homepage and you can send from here.')}</p>}

      {/* ─── 쓰기 ─── */}
      <section aria-labelledby="nl-write" className="space-y-4 rounded-xl border border-line bg-white p-5">
        <h2 id="nl-write" className="text-[16px] font-bold">{t('뉴스레터 보내기', 'Send a newsletter')}</h2>
        <label className="block text-[13px]">
          <span className="field-label">{t('제목', 'Subject')}</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="field-input" />
        </label>
        <label className="block text-[13px]">
          <span className="field-label">{t('머리말 (선택)', 'Intro (optional)')}</span>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} maxLength={3000} placeholder={t('이번 호에서 전하고 싶은 말을 짧게 적어 주세요.', 'Write a short note about this issue.')} className="field-input resize-y" />
        </label>
        <fieldset>
          <legend className="field-label">{t('보낼 기사', 'Stories to send')} <span className="font-normal text-muted">({picked.length}/15 · {t('고른 순서대로 들어갑니다', 'included in the order you pick them')})</span></legend>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {articles.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2.5 text-[13.5px] hover:bg-line/30">
                  <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4" />
                  {picked.includes(a.id) && <span className="w-5 text-center text-[12px] font-bold tabular-nums text-published">{picked.indexOf(a.id) + 1}</span>}
                  <span className="min-w-[10rem] flex-1 truncate">{a.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">{a.category ? `${a.category} · ` : ''}{formatDate(a.published_at, lang)}</span>
                </label>
              </li>
            ))}
            {!articles.length && <li className="px-3 py-6 text-center text-[13px] text-muted">{t('발행된 기사가 없습니다.', 'There are no published stories.')}</li>}
          </ul>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await previewNewsletter(draft()); if (r.html) { setPreview(r.html); setMsg({}) } else setMsg({ error: r.error }) })} className="btn-secondary">{t('미리보기', 'Preview')}</button>
          <button type="button" disabled={pending || !mailOn} onClick={() => run(() => sendTestNewsletter(draft()))} className="btn-secondary">{t('나에게 시험 발송', 'Send a test to me')}</button>
          <button
            type="button"
            disabled={pending || !mailOn || !counts.subscribed || !quota || left <= 0 || overPerSend}
            onClick={() => { if (window.confirm(t(`구독자 ${counts.subscribed.toLocaleString()}명에게 “${subject}”를 보낼까요? 보낸 뒤에는 되돌릴 수 없습니다.`, `Send “${subject}” to ${counts.subscribed.toLocaleString('en-US')} ${counts.subscribed === 1 ? 'subscriber' : 'subscribers'}? This cannot be undone once sent.`))) run(() => sendNewsletter(draft()), true) }}
            className="btn-publish px-5"
          >
            {pending ? t('처리 중…', 'Working…') : t(`구독자 ${counts.subscribed.toLocaleString()}명에게 보내기`, `Send to ${counts.subscribed.toLocaleString('en-US')} ${counts.subscribed === 1 ? 'subscriber' : 'subscribers'}`)}
          </button>
          <span className="text-[12px] text-muted">
            {quota ? <>{t('요금제 한도', 'Plan limit')} {ql(quota)} ({t(`월 ${quota.perMonth}회`, `${quota.perMonth} per month`)}) · {t('이번 달', 'This month:')} <b className={left ? 'text-ink' : 'text-danger'}>{t(`${left}회 남음`, `${left} left`)}</b></> : t('스탠다드 요금제부터 보낼 수 있습니다', 'Sending is available from the Standard plan')}
          </span>
          {overPerSend && <span className="w-full text-[12.5px] font-semibold text-danger">{t(`구독자(${counts.subscribed.toLocaleString()}명)가 회당 한도(${quota!.perSend.toLocaleString()}명)보다 많습니다. 요금제 변경을 문의해 주세요.`, `You have more subscribers (${counts.subscribed.toLocaleString('en-US')}) than the per-send limit (${quota!.perSend.toLocaleString('en-US')}). Contact Support about changing plans.`)}</span>}
        </div>
        {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`text-[13.5px] font-semibold ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}
        {preview && (
          <div className="overflow-hidden rounded-lg border border-line">
            <p className="flex items-center justify-between bg-paper px-3 py-2 text-[12.5px] text-muted">{t('미리보기', 'Preview')} <button type="button" onClick={() => setPreview('')} className="underline">{t('닫기', 'Close')}</button></p>
            <iframe title={t('뉴스레터 미리보기', 'Newsletter preview')} srcDoc={preview} sandbox="" className="h-[640px] w-full bg-white" />
          </div>
        )}
      </section>

      {children}

      {/* ─── 보낸 기록 ─── */}
      <section aria-labelledby="nl-sent" className="rounded-xl border border-line bg-white">
        <h2 id="nl-sent" className="border-b border-line px-5 py-3 text-[15px] font-bold">{t('보낸 뉴스레터', 'Sent newsletters')}</h2>
        {campaigns.length ? (
          <ul className="divide-y divide-line text-[13.5px]">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5">
                <span className="min-w-[10rem] flex-1 truncate font-medium">{c.subject}</span>
                <span className="tabular-nums text-muted">{t(`${c.recipient_count.toLocaleString()}명`, `${c.recipient_count.toLocaleString('en-US')} ${c.recipient_count === 1 ? 'recipient' : 'recipients'}`)}{c.failed_count ? ` · ${t('실패', 'failed')} ${c.failed_count}` : ''} · {formatDateTime(c.sent_at, lang)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-5 text-[13px] text-muted">{t('아직 보낸 뉴스레터가 없습니다.', 'No newsletters sent yet.')}</p>}
      </section>

      {/* ─── 구독자 ─── */}
      <section aria-labelledby="nl-subs" className="rounded-xl border border-line bg-white">
        <h2 id="nl-subs" className="border-b border-line px-5 py-3 text-[15px] font-bold">{t('구독자', 'Subscribers')} <span className="text-[12.5px] font-normal text-muted">· {t('홈페이지 아래 구독 칸에서 신청하고 확인 메일을 누른 독자', 'Readers who signed up in the box at the bottom of your homepage and clicked the confirmation email')}</span></h2>
        <div className="space-y-2 border-b border-line px-5 py-4">
          <label className="block text-[13px]">
            <span className="field-label">{t('직접 추가 (한 줄에 하나씩)', 'Add manually (one per line)')}</span>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'reader1@example.com\nreader2@example.com'} className="field-input resize-y font-mono text-[12.5px]" />
          </label>
          <label className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>{t('이 주소들은 뉴스레터 수신에', 'These addresses belong to people who have')} <strong>{t('직접 동의한', 'given their own consent')}</strong> {t('분들입니다. (동의 없이 보내면 정보통신망법 위반이 될 수 있습니다)', 'to receive the newsletter. (Sending without consent may violate anti-spam and data protection laws.)')}</span>
          </label>
          <button type="button" disabled={pending || !paste.trim() || !consent} onClick={() => run(async () => { const r = await addSubscribers(paste, consent); if (r.ok) { setPaste(''); setConsent(false) } return r }, true)} className="btn-secondary">{t('추가', 'Add')}</button>
        </div>
        {subscribers.length ? (
          <ul className="divide-y divide-line text-[13px]">
            {subscribers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2">
                <span className="min-w-[10rem] flex-1 truncate">{s.email}</span>
                <span className="text-muted">{(SUB_STATUS[lang] as Record<string, string>)[s.status] ?? s.status}{s.source === 'import' ? t(' · 직접 추가', ' · added manually') : ''} · {formatDate(s.created_at, lang)}</span>
                <button type="button" disabled={pending} onClick={() => { if (window.confirm(t(`${s.email}을(를) 목록에서 지울까요?`, `Remove ${s.email} from the list?`))) run(() => removeSubscriber(s.id), true) }} className="text-[12px] text-danger underline">{t('지우기', 'Remove')}</button>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-5 text-[13px] text-muted">{t('아직 구독자가 없습니다.', 'No subscribers yet.')}</p>}
      </section>
    </div>
  )
}
