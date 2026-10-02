'use client'

import { useEffect, useState } from 'react'
import { submitReview, type ReviewReveal } from '@/app/ai-review/[token]/actions'
import type { AiDraft } from '@/lib/ai-draft'
import type { DraftIssue } from '@/lib/ai-check'

export type ReviewRelease = {
  id: string
  title: string
  source: string
  text: string
  drafts: { slot: string; label: string | null; draft: AiDraft; issues: DraftIssue[]; ms: number | null; costUsd: number | null }[]
}

type Saved = { reviewer: string; picks: Record<string, string>; notes: Record<string, string>; comment: string }

const WON = 1400

// 링크를 받은 기자가 보도자료마다 가장 좋은 초안을 고르고 의견을 남기는 화면
export default function AiReview({ token, title, blind, modelCount, expiresAt, releases }: {
  token: string; title: string; blind: boolean; modelCount: number; expiresAt: string; releases: ReviewRelease[]
}) {
  const store = `im-ai-review-${token}`
  const [form, setForm] = useState<Saved>({ reviewer: '', picks: {}, notes: {}, comment: '' })
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ reveal?: ReviewReveal } | null>(null)

  // 쓰던 검토는 이 브라우저에 임시 저장 (새로고침해도 이어서)
  useEffect(() => {
    try { const s = localStorage.getItem(store); if (s) setForm(JSON.parse(s)) } catch {}
  }, [store])
  useEffect(() => {
    if (done) return
    try { localStorage.setItem(store, JSON.stringify(form)) } catch {}
  }, [form, store, done])

  const [tried, setTried] = useState(false)
  // 자료마다 초안 고르기 + 한 줄 의견(5자 이상)이 모두 있어야 보낼 수 있다
  const MIN_NOTE = 5
  const noteOk = (id: string) => (form.notes[id] ?? '').trim().length >= MIN_NOTE
  const isDone = (id: string) => !!form.picks[id] && noteOk(id)
  const completed = releases.filter((r) => isDone(r.id)).length

  async function submit() {
    setError('')
    setTried(true)
    const firstMissing = releases.findIndex((r) => !isDone(r.id))
    if (firstMissing >= 0) {
      const left = releases.length - completed
      setError(`아직 ${left}건이 남았습니다. 자료마다 초안 하나를 고르고 한 줄 의견(${MIN_NOTE}자 이상)을 적어 주세요.`)
      document.getElementById(`review-${firstMissing + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (!form.reviewer.trim()) { setError('이름을 적어 주세요.'); return }
    if (form.comment.trim().length < 10) { setError('전체 의견을 10자 이상 적어 주세요.'); return }
    setBusy(true)
    const res = await submitReview(token, form).catch(() => ({ error: '보내지 못했습니다. 잠시 뒤 다시 눌러 주세요.' } as const))
    setBusy(false)
    if ('error' in res && res.error) { setError(res.error); return }
    try { localStorage.removeItem(store) } catch {}
    setDone({ reveal: 'reveal' in res ? res.reveal : undefined })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-8">
          <p className="text-[12px] font-bold tracking-wide text-review">IM 뉴스룸 · AI 초안 검토</p>
          <h1 className="mt-1 text-[21px] font-bold tracking-tight" style={{ textWrap: 'balance' }}>{title}</h1>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-muted">
            같은 보도자료로 AI {modelCount}종이 쓴 기사 초안입니다. 자료마다 <strong className="text-ink">기사로 내기에 가장 좋은 초안 하나</strong>를 골라 주세요.
            {blind && ' 선입견 없이 보시도록 어떤 AI가 썼는지는 가려 두었고, 보내 주시면 공개됩니다.'}
            {' '}고른 이유나 고칠 점을 자료마다 <strong className="text-ink">한 줄 의견</strong>으로 꼭 남겨 주세요. 의견은 IM 뉴스룸 운영팀만 봅니다.
          </p>
          <p className="mt-1 text-[12px] text-muted">링크 사용 기한 {new Date(expiresAt).toLocaleDateString('ko-KR')}까지</p>
        </div>
      </header>

      {done ? (
        <main className="mx-auto max-w-[900px] px-4 py-10 sm:px-8">
          <div className="rounded-lg border border-published/30 bg-white p-6">
            <h2 className="text-[18px] font-bold text-published">검토를 보냈습니다. 고맙습니다!</h2>
            <p className="mt-1 text-[13.5px] text-muted">보내 주신 의견은 IM 뉴스룸 운영팀이 AI 모델을 고를 때 씁니다.</p>
          </div>
          {done.reveal && (
            <section className="mt-6 rounded-lg border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3 text-[15px] font-bold">어떤 AI가 썼는지 공개</h2>
              <ul className="divide-y divide-line">
                {releases.map((r) => (
                  <li key={r.id} className="px-5 py-3">
                    <p className="truncate text-[13.5px] font-semibold">{r.title}</p>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                      {Object.entries(done.reveal![r.id] ?? {}).map(([slot, name]) => (
                        <span key={slot} className={form.picks[r.id] === slot ? 'font-bold text-published' : ''}>
                          {slot} = {name}{form.picks[r.id] === slot && ' ✓ 내 선택'}
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-[1400px] space-y-5 px-4 py-6 sm:px-8">
          {releases.map((r, idx) => (
            <section key={r.id} id={`review-${idx + 1}`} className={`scroll-mt-4 rounded-lg border bg-white ${tried && !isDone(r.id) ? 'border-danger' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
                <span className="text-[12px] font-bold tabular-nums text-muted">{idx + 1}/{releases.length}</span>
                {isDone(r.id) && <span className="rounded bg-published/10 px-1.5 text-[11px] font-semibold text-published">✓ 완료</span>}
                <h2 className="min-w-0 flex-1 text-[15px] font-bold leading-snug">{r.title}</h2>
                <span className="text-[11.5px] text-muted">{r.source}</span>
                <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-[12.5px] text-review underline underline-offset-2">
                  {open === r.id ? '보도자료 원문 접기' : '보도자료 원문 보기'}
                </button>
              </div>
              {open === r.id && <p className="max-h-80 overflow-y-auto whitespace-pre-line border-b border-line bg-[#F8F9FA] px-5 py-3 text-[13px] leading-relaxed">{r.text}</p>}

              <div
                className="grid gap-px bg-line md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
                style={{ ['--n' as string]: r.drafts.length }}
              >
                {r.drafts.map((d) => {
                  const chosen = form.picks[r.id] === d.slot
                  return (
                    <div key={d.slot} className={`flex min-w-0 flex-col bg-white p-4 ${chosen ? 'ring-2 ring-inset ring-published' : ''}`}>
                      <p className="mb-2 flex flex-wrap items-center gap-2 text-[12px] font-bold text-muted">
                        <span className="rounded bg-ink px-1.5 py-0.5 text-white">초안 {d.slot}</span>
                        {d.label && <span className="text-ink">{d.label}</span>}
                        {d.ms !== null && d.costUsd !== null && (
                          <span className="font-normal">{(d.ms / 1000).toFixed(1)}초 · {Math.round(d.costUsd * WON).toLocaleString()}원</span>
                        )}
                      </p>
                      {d.issues.length > 0 && (
                        <p className="mb-2 rounded bg-danger/5 px-2 py-1.5 text-[11.5px] text-danger">
                          ⚠ 원문에서 못 찾은 {d.issues.map((i) => (i.kind === 'number' ? `숫자 ${i.text}` : `인용 “${i.text}”`)).join(', ')}
                        </p>
                      )}
                      <div className="flex-1 text-[14px] leading-relaxed">
                        <p className="text-[16px] font-bold leading-snug">{d.draft.title}</p>
                        {d.draft.subtitle && <p className="mt-1 text-[13px] text-muted">{d.draft.subtitle}</p>}
                        <div className="mt-2 space-y-2">{d.draft.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, picks: { ...form.picks, [r.id]: d.slot } })}
                        className={`mt-4 rounded-lg border px-3 py-2 text-[13.5px] font-semibold ${chosen ? 'border-published bg-published text-white' : 'border-line hover:border-ink'}`}
                        aria-pressed={chosen}
                      >
                        {chosen ? `✓ 초안 ${d.slot}가 가장 좋아요` : `초안 ${d.slot}가 가장 좋아요`}
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className="border-t border-line px-4 py-3 sm:px-5">
                <label htmlFor={`note-${r.id}`} className="mb-1 block text-[12.5px] font-semibold">
                  한 줄 의견 <span className="text-danger">(필수)</span>
                </label>
                <input
                  id={`note-${r.id}`}
                  value={form.notes[r.id] ?? ''}
                  onChange={(e) => setForm({ ...form, notes: { ...form.notes, [r.id]: e.target.value } })}
                  maxLength={500}
                  required
                  aria-invalid={tried && !noteOk(r.id)}
                  placeholder="예: B는 제목이 좋은데 3문단에 원문에 없는 표현이 있음"
                  className={`w-full rounded-md border px-3 py-2 text-[13.5px] outline-none focus:border-ink ${tried && !noteOk(r.id) ? 'border-danger bg-danger/5' : 'border-line'}`}
                />
                {tried && !isDone(r.id) && (
                  <p className="mt-1 text-[12px] text-danger">
                    {!form.picks[r.id] && '가장 좋은 초안을 골라 주세요. '}
                    {!noteOk(r.id) && `한 줄 의견을 ${MIN_NOTE}자 이상 적어 주세요.`}
                  </p>
                )}
              </div>
            </section>
          ))}

          <section className="rounded-lg md:sticky md:bottom-0 md:rounded-b-none border border-line bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] sm:p-5">
            <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
              <label className="block text-[12.5px] font-semibold">
                이름 <span className="text-danger">(필수)</span>
                <input
                  value={form.reviewer}
                  onChange={(e) => setForm({ ...form, reviewer: e.target.value })}
                  maxLength={40}
                  placeholder="예: 홍길동 기자"
                  required
                  aria-invalid={tried && !form.reviewer.trim()}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-[14px] font-normal outline-none focus:border-ink ${tried && !form.reviewer.trim() ? 'border-danger bg-danger/5' : 'border-line'}`}
                />
              </label>
              <label className="block text-[12.5px] font-semibold">
                전체 의견 <span className="text-danger">(필수)</span>
                <input
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  maxLength={2000}
                  placeholder="전체적으로 어떤 초안이 실제 기사에 가까웠는지 (10자 이상)"
                  required
                  aria-invalid={tried && form.comment.trim().length < 10}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-[14px] font-normal outline-none focus:border-ink ${tried && form.comment.trim().length < 10 ? 'border-danger bg-danger/5' : 'border-line'}`}
                />
              </label>
              <button type="button" onClick={submit} disabled={busy} className="btn-publish px-6 py-2.5">
                {busy ? '보내는 중…' : `검토 보내기 (${completed}/${releases.length} 완료)`}
              </button>
            </div>
            {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
          </section>
        </main>
      )}
    </div>
  )
}
