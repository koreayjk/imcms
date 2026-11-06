'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createAiReviewArticle, type BulkResult } from '@/app/(main)/press/actions'
import { useT } from '@/components/cms/CmsLang'

// 보도자료 목록 + 일괄 만들기: 체크한 보도자료를 AI로 기사로 만들어 "승인대기"로 보낸다 (한 번에 최대 10건, 한 건씩 차례로)
export type BulkRow = { id: string; title: string; summary: string | null; sourceName: string; date: string; dateIso: string | null; used: boolean; badges: string[]; head: string | null }

const MAX = 10
// 기사 분량(본문 글자 수). 0 = AI가 원문에 맞춰 알아서
const LENGTHS = [0, 800, 1000, 1500] as const
type Len = (typeof LENGTHS)[number]
const LEN_KEY = 'press-bulk-length'

export default function PressBulkList({ rows }: { rows: BulkRow[] }) {
  const t = useT()
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null)
  const [results, setResults] = useState<BulkResult[]>([])
  const [len, setLen] = useState<Len>(0)
  // 마지막으로 고른 분량을 기억한다 (이 브라우저에만)
  useEffect(() => {
    try { const v = Number(localStorage.getItem(LEN_KEY)); if ((LENGTHS as readonly number[]).includes(v)) setLen(v as Len) } catch { /* 저장소를 못 써도 괜찮다 */ }
  }, [])
  const pickLen = (v: Len) => { setLen(v); try { localStorage.setItem(LEN_KEY, String(v)) } catch { /* 무시 */ } }

  const usable = rows.filter((r) => !r.used)
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= MAX ? cur : [...cur, id]))
  const titleOf = (id: string) => rows.find((r) => r.id === id)?.title ?? ''

  const run = async () => {
    const ids = picked.slice(0, MAX)
    if (!ids.length || running) return
    setRunning(true)
    setResults([])
    const out: BulkResult[] = []
    for (let i = 0; i < ids.length; i++) {
      setProgress({ done: i, total: ids.length, title: titleOf(ids[i]) })
      let r: BulkResult
      try { r = await createAiReviewArticle(ids[i], len || undefined) } catch { r = { ok: false, id: ids[i], title: titleOf(ids[i]), error: t('서버가 응답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.', 'The server did not respond. Try again shortly.') } }
      out.push(r)
      setResults([...out])
      if (r.stop) break   // 한도를 다 썼거나 매체가 없으면 더 하지 않는다
    }
    setProgress(null)
    setRunning(false)
    setPicked([])
    router.refresh()
  }

  const okCount = results.filter((r) => r.ok).length

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur md:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {/* 1) 고르기 */}
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink tabular-nums" aria-live="polite">{t(`${picked.length}/${MAX}건 선택`, `${picked.length}/${MAX} selected`)}</span>
            <button type="button" disabled={running || usable.length === 0} onClick={() => setPicked(usable.slice(0, MAX).map((r) => r.id))} className="btn-secondary px-3 py-1 text-[12px] disabled:opacity-40">{t(`위에서 ${MAX}건`, `First ${MAX}`)}</button>
            {picked.length > 0 && !running && <button type="button" onClick={() => setPicked([])} className="text-[12px] text-muted underline">{t('모두 해제', 'Clear')}</button>}
          </div>
          {/* 2) 기사 분량 */}
          <div className="flex items-center gap-2" role="group" aria-label={t('기사 분량', 'Story length')}>
            <span className="text-[12px] text-muted">{t('분량', 'Length')}</span>
            <div className="inline-flex overflow-hidden rounded border border-line text-[12px]">
              {LENGTHS.map((v) => (
                <button key={v} type="button" disabled={running} onClick={() => pickLen(v)} aria-pressed={len === v}
                  className={`px-2.5 py-1 tabular-nums transition-colors disabled:opacity-50 ${len === v ? 'bg-ink font-semibold text-white' : 'bg-white text-ink hover:bg-[#F1F3F2]'}`}>
                  {v === 0 ? t('자동', 'Auto') : t(`${v.toLocaleString('ko-KR')}자`, `~${v.toLocaleString('en-US')}`)}
                </button>
              ))}
            </div>
          </div>
          {/* 3) 만들기 */}
          <button type="button" disabled={picked.length === 0 || running} onClick={run} className="btn-primary ml-auto px-3.5 py-1.5 text-[12.5px] disabled:opacity-40">
            {running ? t('만드는 중…', 'Creating…') : t(`AI 기사로 만들어 승인대기로${picked.length ? ` (${picked.length}건)` : ''}`, `Create AI stories → pending review${picked.length ? ` (${picked.length})` : ''}`)}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          {t('체크한 보도자료를 AI가 기사 초안으로 써서 승인대기로 보냅니다. 발행은 편집장이 확인한 뒤에 합니다. 원문이 짧으면 분량을 채우려고 내용을 지어내지 않고 짧게 씁니다.', 'AI writes a draft story from each checked release and sends it to pending review; an editor publishes after checking. If the source is short, the draft stays short rather than inventing content.')}
        </p>
      </div>

      {(progress || results.length > 0) && (
        <div className="border-b border-line bg-[#F8F9FA] px-4 py-3 text-[12.5px] leading-relaxed md:px-5" role="status">
          {progress && (
            <p className="font-semibold">
              {t(`${progress.done + 1}/${progress.total} 만드는 중… 창을 닫지 마세요`, `Creating ${progress.done + 1}/${progress.total}… keep this window open`)}
              <span className="ml-1.5 font-normal text-muted">{progress.title}</span>
            </p>
          )}
          {results.length > 0 && (
            <>
              {!progress && <p className="font-semibold">{t(`${okCount}건을 승인대기로 올렸습니다.`, `${okCount} stories were sent to pending review.`)} <Link href="/articles" className="underline">{t('기사 목록에서 확인', 'See them in Stories')}</Link></p>}
              <ul className="mt-1 space-y-0.5">
                {results.map((r) => (
                  <li key={r.id} className={r.ok ? 'text-published' : 'text-danger'}>
                    {r.ok ? '✓' : '✕'} {r.title ?? titleOf(r.id)}
                    {r.ok && r.articleId && <> — <Link href={`/articles/${r.articleId}/edit`} className="underline">{t('열기', 'Open')}</Link></>}
                    {!r.ok && r.error && <span className="text-muted"> — {r.error}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id}>
            {r.head && <p className="bg-[#F8F9FA] px-4 py-1.5 text-[12px] font-bold text-ink md:px-5">{r.head}</p>}
            <div className="flex items-start hover:bg-[#F8F9FA]">
              <label className="flex shrink-0 cursor-pointer items-start py-4 pl-4 pr-1 md:pl-5">
                <input type="checkbox" disabled={r.used || running} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={t(`${r.title} 선택`, `Select ${r.title}`)} className="mt-1" />
              </label>
              <Link href={`/press/${r.id}`} className="block min-w-0 flex-1 px-3 py-4 md:pr-5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
                  {r.badges.map((b) => <span key={b} className="rounded bg-ink/10 px-1.5 py-0.5 font-semibold text-ink">{b}</span>)}
                  <span className="rounded bg-line/70 px-1.5 py-0.5">{r.sourceName}</span>
                  <time className="tabular-nums" dateTime={r.dateIso ?? undefined}>{r.date}</time>
                  {r.used && <span className="rounded bg-published/10 px-1.5 py-0.5 font-semibold text-published">{t('기사화됨', 'Story created')}</span>}
                </div>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug">{r.title}</p>
                {r.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{r.summary}</p>}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
