'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createAiReviewArticle, type BulkResult } from '@/app/(main)/press/actions'
import { useT } from '@/components/cms/CmsLang'

// 보도자료 목록 + 일괄 만들기: 체크한 보도자료를 AI로 기사로 만들어 "승인대기"로 보낸다 (한 번에 최대 10건, 한 건씩 차례로)
export type BulkRow = { id: string; title: string; summary: string | null; sourceName: string; date: string; dateIso: string | null; used: boolean; badges: string[]; head: string | null }

const MAX = 10

export default function PressBulkList({ rows }: { rows: BulkRow[] }) {
  const t = useT()
  const router = useRouter()
  const [picked, setPicked] = useState<string[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; title: string } | null>(null)
  const [results, setResults] = useState<BulkResult[]>([])

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
      try { r = await createAiReviewArticle(ids[i]) } catch { r = { ok: false, id: ids[i], title: titleOf(ids[i]), error: t('서버가 응답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.', 'The server did not respond. Try again shortly.') } }
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
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur md:px-5">
        <span className="text-[12.5px] text-muted">
          {picked.length > 0 ? <b className="text-ink">{t(`${picked.length}건 선택`, `${picked.length} selected`)}</b> : t('체크한 보도자료를 한꺼번에 AI 기사로 만들 수 있습니다', 'Check releases to turn them into AI stories in one go')}
          <span className="ml-1">({t(`한 번에 최대 ${MAX}건`, `up to ${MAX} at a time`)})</span>
        </span>
        <button type="button" disabled={running || usable.length === 0} onClick={() => setPicked(usable.slice(0, MAX).map((r) => r.id))} className="btn-secondary px-3 py-1 text-[12px] disabled:opacity-40">{t(`위에서 ${MAX}건 선택`, `Select first ${MAX}`)}</button>
        {picked.length > 0 && !running && <button type="button" onClick={() => setPicked([])} className="text-[12px] text-muted underline">{t('선택 해제', 'Clear')}</button>}
        <button type="button" disabled={picked.length === 0 || running} onClick={run} className="btn-primary ml-auto px-3.5 py-1.5 text-[12.5px] disabled:opacity-40">
          {running ? t('만드는 중…', 'Creating…') : t('AI 기사로 만들어 승인대기로 보내기', 'Create AI stories → pending review')}
        </button>
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
