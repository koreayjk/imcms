'use client'

import { useEffect, useMemo, useState } from 'react'
import { prepareReleases, runDraft, type CompareRelease, type CompareResult } from '@/app/(main)/admin/ai-compare/actions'

type Model = { id: string; label: string; input: number; output: number; ready: boolean; note?: string }
type Run = { releases: CompareRelease[]; models: string[]; results: Record<string, CompareResult | 'running'>; at: string }

const WON = 1400
const won = (usd: number) => `${Math.round(usd * WON).toLocaleString()}원`
const STORE = 'im-ai-compare-last'
const key = (r: string, m: string) => `${r}|${m}`

export default function AiCompare({ models }: { models: Model[] }) {
  const [picked, setPicked] = useState<string[]>(() => models.filter((m) => m.ready).map((m) => m.id).filter((id) => id !== 'gemini-3.5-flash-lite'))
  const [run, setRun] = useState<Run | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  // 지난 비교 결과는 이 브라우저에만 남겨 둔다
  useEffect(() => {
    try { const s = localStorage.getItem(STORE); if (s) setRun(JSON.parse(s)) } catch {}
  }, [])
  useEffect(() => {
    if (!run || busy) return
    try { localStorage.setItem(STORE, JSON.stringify(run)) } catch {}
  }, [run, busy])

  const ready = models.filter((m) => m.ready)
  // 대략 예상 비용: 보도자료 1건 = 입력 4천·출력 3천 토큰
  const estimate = picked.reduce((a, id) => {
    const m = models.find((x) => x.id === id)!
    return a + 10 * (4000 * m.input + 3000 * m.output) / 1e6
  }, 0)

  async function start() {
    setError('')
    setBusy(true)
    const prep = await prepareReleases(10)
    if (prep.error || !prep.releases?.length) {
      setError(prep.error ?? '비교할 보도자료가 없습니다. 보도자료함을 한 번 열어 자료를 모아 주세요.')
      setBusy(false)
      return
    }
    const next: Run = { releases: prep.releases, models: picked, results: {}, at: new Date().toISOString() }
    setRun(next)
    const jobs = prep.releases.flatMap((r) => picked.map((m) => ({ r, m })))
    // 3개씩 동시에
    let i = 0
    const worker = async () => {
      while (i < jobs.length) {
        const { r, m } = jobs[i++]
        setRun((prev) => prev && { ...prev, results: { ...prev.results, [key(r.id, m)]: 'running' } })
        const res = await runDraft(m, r).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : '실패' }))
        setRun((prev) => prev && { ...prev, results: { ...prev.results, [key(r.id, m)]: res } })
      }
    }
    await Promise.all([worker(), worker(), worker()])
    setBusy(false)
  }

  const summary = useMemo(() => {
    if (!run) return []
    return run.models.map((id) => {
      const m = models.find((x) => x.id === id)
      const rs = run.releases.map((r) => run.results[key(r.id, id)]).filter((x): x is Extract<CompareResult, { ok: true }> => !!x && x !== 'running' && x.ok)
      const failed = run.releases.filter((r) => { const x = run.results[key(r.id, id)]; return x && x !== 'running' && !x.ok }).length
      const avg = (f: (x: (typeof rs)[number]) => number) => (rs.length ? rs.reduce((a, x) => a + f(x), 0) / rs.length : 0)
      return {
        id, label: m?.label ?? id, done: rs.length, failed,
        ms: avg((x) => x.ms), cost: avg((x) => x.costUsd),
        issues: rs.reduce((a, x) => a + x.issues.length, 0),
        chars: avg((x) => x.draft.paragraphs.join('').length),
      }
    })
  }, [run, models])

  const total = run ? run.releases.length * run.models.length : 0
  const finished = run ? Object.values(run.results).filter((x) => x !== 'running').length : 0

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">비교할 모델</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {models.map((m) => (
            <label key={m.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[13.5px] ${m.ready ? 'cursor-pointer border-line hover:border-ink' : 'border-dashed border-line opacity-60'}`}>
              <input type="checkbox" disabled={!m.ready || busy} checked={picked.includes(m.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, m.id] : picked.filter((x) => x !== m.id))} />
              <span>
                <strong>{m.label}</strong>
                <span className="ml-1.5 text-[11.5px] text-muted">${m.input} / ${m.output}</span>
                {!m.ready && <span className="ml-1.5 text-[11.5px] text-danger">{m.id.startsWith('gemini') ? 'GEMINI_API_KEY 필요' : 'ANTHROPIC_API_KEY 필요'}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} disabled={busy || !picked.length} className="btn-publish px-5">
            {busy ? `비교 중… ${finished}/${total}` : '최근 보도자료 10건으로 비교 시작'}
          </button>
          {!busy && picked.length > 0 && <span className="text-[12.5px] text-muted">예상 비용 약 {won(estimate)} · 보통 2~4분 걸립니다</span>}
          {!ready.length && <span className="text-[12.5px] text-danger">Vercel에 AI 키를 넣고 다시 배포해야 비교할 수 있습니다.</span>}
        </div>
        {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
      </section>

      {run && (
        <>
          <section className="overflow-x-auto rounded-lg border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3 text-[15px] font-bold">
              요약 <span className="text-[12px] font-normal text-muted">{new Date(run.at).toLocaleString('ko-KR')} · 보도자료 {run.releases.length}건</span>
            </h2>
            <table className="w-full text-[13.5px] tabular-nums">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="px-5 py-2 font-medium">모델</th><th className="px-3 py-2 text-right font-medium">완료</th><th className="px-3 py-2 text-right font-medium">실패</th>
                  <th className="px-3 py-2 text-right font-medium">평균 시간</th><th className="px-3 py-2 text-right font-medium">기사 1건 비용</th><th className="px-3 py-2 text-right font-medium">하루 10건 한 달</th>
                  <th className="px-3 py-2 text-right font-medium">원문에 없는 숫자·인용</th><th className="px-5 py-2 text-right font-medium">평균 본문 길이</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-2.5 font-bold">{s.label}</td>
                    <td className="px-3 py-2.5 text-right">{s.done}</td>
                    <td className={`px-3 py-2.5 text-right ${s.failed ? 'font-bold text-danger' : ''}`}>{s.failed}</td>
                    <td className="px-3 py-2.5 text-right">{s.done ? `${(s.ms / 1000).toFixed(1)}초` : '-'}</td>
                    <td className="px-3 py-2.5 text-right">{s.done ? won(s.cost) : '-'}</td>
                    <td className="px-3 py-2.5 text-right">{s.done ? won(s.cost * 300) : '-'}</td>
                    <td className={`px-3 py-2.5 text-right ${s.issues ? 'font-bold text-danger' : 'text-published'}`}>{s.done ? `${s.issues}건` : '-'}</td>
                    <td className="px-5 py-2.5 text-right">{s.done ? `${Math.round(s.chars).toLocaleString()}자` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-line px-5 py-2.5 text-[11.5px] text-muted">
              비용은 실제 사용 토큰 × 공시 가격(1달러 {WON}원)으로 계산했습니다. “원문에 없는 숫자·인용”은 자동 점검이라 표현만 바뀐 경우도 잡힐 수 있으니, 아래에서 직접 확인하세요.
            </p>
          </section>

          <div className="space-y-4">
            {run.releases.map((r, idx) => (
              <section key={r.id} className="rounded-lg border border-line bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                  <span className="text-[12px] font-bold text-muted">{idx + 1}</span>
                  <h3 className="min-w-0 flex-1 truncate text-[14.5px] font-bold">{r.title}</h3>
                  <span className="text-[11.5px] text-muted">{r.source}</span>
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-[12px] text-review underline underline-offset-2">{open === r.id ? '원문 접기' : '원문 보기'}</button>
                </div>
                {open === r.id && <p className="max-h-72 overflow-y-auto whitespace-pre-line border-b border-line bg-[#F8F9FA] px-5 py-3 text-[12.5px] leading-relaxed">{r.text}</p>}
                <div className="grid gap-px bg-line" style={{ gridTemplateColumns: `repeat(${run.models.length}, minmax(260px, 1fr))` }}>
                  {run.models.map((m) => {
                    const res = run.results[key(r.id, m)]
                    const label = models.find((x) => x.id === m)?.label ?? m
                    return (
                      <div key={m} className="min-w-0 bg-white p-4">
                        <p className="mb-2 flex items-center gap-2 text-[11.5px] font-bold text-muted">
                          {label}
                          {res && res !== 'running' && res.ok && <span className="font-normal">{(res.ms / 1000).toFixed(1)}초 · {won(res.costUsd)}</span>}
                        </p>
                        {!res ? <p className="text-[12.5px] text-muted">대기 중</p>
                          : res === 'running' ? <p className="text-[12.5px] text-review">작성 중…</p>
                          : !res.ok ? <p className="text-[12.5px] text-danger">실패: {res.error}</p>
                          : (
                            <div className="text-[13px] leading-relaxed">
                              {res.issues.length > 0 && (
                                <p className="mb-2 rounded bg-danger/5 px-2 py-1.5 text-[11.5px] text-danger">
                                  ⚠ 원문에 없는 {res.issues.map((i) => (i.kind === 'number' ? `숫자 ${i.text}` : `인용 “${i.text}”`)).join(', ')}
                                </p>
                              )}
                              <p className="text-[15px] font-bold leading-snug">{res.draft.title}</p>
                              {res.draft.subtitle && <p className="mt-1 text-[12.5px] text-muted">{res.draft.subtitle}</p>}
                              <div className="mt-2 space-y-1.5">{res.draft.paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>
                              {res.draft.review_notes.length > 0 && (
                                <div className="mt-2 rounded bg-[#FFF8E6] px-2 py-1.5 text-[11.5px]">
                                  <strong>기자 확인 메모</strong>
                                  {res.draft.review_notes.map((n, i) => <p key={i}>• {n}</p>)}
                                </div>
                              )}
                            </div>
                          )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
