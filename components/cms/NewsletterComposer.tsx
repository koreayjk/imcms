'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addSubscribers, previewNewsletter, removeSubscriber, sendNewsletter, sendTestNewsletter, type NlState } from '@/app/(main)/admin/newsletter/actions'
import { formatDate, formatDateTime } from '@/lib/format'

type Art = { id: string; title: string; published_at: string | null; category: string | null }
type Sub = { id: string; email: string; status: string; source: string; created_at: string }
type Camp = { id: string; subject: string; recipient_count: number; failed_count: number; sent_at: string }

const SUB_STATUS: Record<string, string> = { subscribed: '구독 중', pending: '확인 대기', unsubscribed: '수신거부' }

export default function NewsletterComposer({ outletName, articles, counts, subscribers, campaigns, limit, mailOn }: {
  outletName: string; articles: Art[]; counts: { subscribed: number; pending: number; unsubscribed: number }
  subscribers: Sub[]; campaigns: Camp[]; limit: number; mailOn: boolean
}) {
  const router = useRouter()
  const today = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date())
  const [subject, setSubject] = useState(`${outletName} ${today} 주요 뉴스`)
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
        {([['구독 중', counts.subscribed, 'text-published'], ['확인 대기', counts.pending, 'text-muted'], ['수신거부', counts.unsubscribed, 'text-muted']] as const).map(([k, v, c]) => (
          <div key={k} className="rounded-xl border border-line bg-white px-3 py-4">
            <dt className="text-[12.5px] text-muted">{k}</dt>
            <dd className={`mt-1 text-[26px] font-bold tabular-nums ${c}`}>{v.toLocaleString()}</dd>
          </div>
        ))}
      </dl>

      {!mailOn && <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-3 text-[13.5px]">메일 발송이 아직 설정되지 않았습니다. 설정되면 홈페이지 아래에 구독 신청 칸이 생기고, 여기서 보낼 수 있습니다.</p>}

      {/* ─── 쓰기 ─── */}
      <section aria-labelledby="nl-write" className="space-y-4 rounded-xl border border-line bg-white p-5">
        <h2 id="nl-write" className="text-[16px] font-bold">뉴스레터 보내기</h2>
        <label className="block text-[13px]">
          <span className="field-label">제목</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} className="field-input" />
        </label>
        <label className="block text-[13px]">
          <span className="field-label">머리말 (선택)</span>
          <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} maxLength={3000} placeholder="이번 호에서 전하고 싶은 말을 짧게 적어 주세요." className="field-input resize-y" />
        </label>
        <fieldset>
          <legend className="field-label">보낼 기사 <span className="font-normal text-muted">({picked.length}/15 · 고른 순서대로 들어갑니다)</span></legend>
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {articles.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[13.5px] hover:bg-line/30">
                  <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} className="h-4 w-4" />
                  {picked.includes(a.id) && <span className="w-5 text-center text-[12px] font-bold tabular-nums text-published">{picked.indexOf(a.id) + 1}</span>}
                  <span className="min-w-0 flex-1 truncate">{a.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-muted">{a.category ? `${a.category} · ` : ''}{formatDate(a.published_at)}</span>
                </label>
              </li>
            ))}
            {!articles.length && <li className="px-3 py-6 text-center text-[13px] text-muted">발행된 기사가 없습니다.</li>}
          </ul>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await previewNewsletter(draft()); if (r.html) { setPreview(r.html); setMsg({}) } else setMsg({ error: r.error }) })} className="btn-secondary">미리보기</button>
          <button type="button" disabled={pending || !mailOn} onClick={() => run(() => sendTestNewsletter(draft()))} className="btn-secondary">나에게 시험 발송</button>
          <button
            type="button"
            disabled={pending || !mailOn || !counts.subscribed}
            onClick={() => { if (window.confirm(`구독자 ${counts.subscribed.toLocaleString()}명에게 “${subject}”를 보낼까요? 보낸 뒤에는 되돌릴 수 없습니다.`)) run(() => sendNewsletter(draft()), true) }}
            className="btn-publish px-5"
          >
            {pending ? '처리 중…' : `구독자 ${counts.subscribed.toLocaleString()}명에게 보내기`}
          </button>
          <span className="text-[12px] text-muted">한 번에 {limit.toLocaleString()}명까지</span>
        </div>
        {(msg.error || msg.ok) && <p role={msg.error ? 'alert' : 'status'} className={`text-[13.5px] font-semibold ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.error ?? msg.ok}</p>}
        {preview && (
          <div className="overflow-hidden rounded-lg border border-line">
            <p className="flex items-center justify-between bg-paper px-3 py-2 text-[12.5px] text-muted">미리보기 <button type="button" onClick={() => setPreview('')} className="underline">닫기</button></p>
            <iframe title="뉴스레터 미리보기" srcDoc={preview} sandbox="" className="h-[640px] w-full bg-white" />
          </div>
        )}
      </section>

      {/* ─── 보낸 기록 ─── */}
      <section aria-labelledby="nl-sent" className="rounded-xl border border-line bg-white">
        <h2 id="nl-sent" className="border-b border-line px-5 py-3 text-[15px] font-bold">보낸 뉴스레터</h2>
        {campaigns.length ? (
          <ul className="divide-y divide-line text-[13.5px]">
            {campaigns.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate font-medium">{c.subject}</span>
                <span className="tabular-nums text-muted">{c.recipient_count.toLocaleString()}명{c.failed_count ? ` · 실패 ${c.failed_count}` : ''} · {formatDateTime(c.sent_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-5 text-[13px] text-muted">아직 보낸 뉴스레터가 없습니다.</p>}
      </section>

      {/* ─── 구독자 ─── */}
      <section aria-labelledby="nl-subs" className="rounded-xl border border-line bg-white">
        <h2 id="nl-subs" className="border-b border-line px-5 py-3 text-[15px] font-bold">구독자 <span className="text-[12.5px] font-normal text-muted">· 홈페이지 아래 구독 칸에서 신청하고 확인 메일을 누른 독자</span></h2>
        <div className="space-y-2 border-b border-line px-5 py-4">
          <label className="block text-[13px]">
            <span className="field-label">직접 추가 (한 줄에 하나씩)</span>
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder={'reader1@example.com\nreader2@example.com'} className="field-input resize-y font-mono text-[12.5px]" />
          </label>
          <label className="flex items-start gap-2 text-[12.5px]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            <span>이 주소들은 뉴스레터 수신에 <strong>직접 동의한</strong> 분들입니다. (동의 없이 보내면 정보통신망법 위반이 될 수 있습니다)</span>
          </label>
          <button type="button" disabled={pending || !paste.trim() || !consent} onClick={() => run(async () => { const r = await addSubscribers(paste, consent); if (r.ok) { setPaste(''); setConsent(false) } return r }, true)} className="btn-secondary">추가</button>
        </div>
        {subscribers.length ? (
          <ul className="divide-y divide-line text-[13px]">
            {subscribers.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 px-5 py-2">
                <span className="min-w-0 flex-1 truncate">{s.email}</span>
                <span className="text-muted">{SUB_STATUS[s.status] ?? s.status}{s.source === 'import' ? ' · 직접 추가' : ''} · {formatDate(s.created_at)}</span>
                <button type="button" disabled={pending} onClick={() => { if (window.confirm(`${s.email}을(를) 목록에서 지울까요?`)) run(() => removeSubscriber(s.id), true) }} className="text-[12px] text-danger underline">지우기</button>
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-5 text-[13px] text-muted">아직 구독자가 없습니다.</p>}
      </section>
    </div>
  )
}
