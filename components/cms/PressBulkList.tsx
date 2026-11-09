'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useT } from '@/components/cms/CmsLang'
import { useBulkAi } from '@/components/cms/BulkAiProvider'
import { ImageIcon } from '@/components/cms/icons'
import { hidePress } from '@/app/(main)/press/actions'

// 보도자료 목록 + 일괄 만들기: 체크한 보도자료를 AI로 기사로 만들어 "승인대기"로 보낸다 (한 번에 최대 10건, 한 건씩 차례로)
export type BulkRow = { id: string; title: string; summary: string | null; sourceName: string; date: string; dateIso: string | null; used: boolean; chars: number | null; photos: number; badges: string[]; head: string | null }

const MAX = 10
// 가리기·되돌리기는 한 번에 50건까지 (AI 기사 만들기는 10건까지)
const HIDE_MAX = 50
// 기사 분량(본문 글자 수). 0 = AI가 원문에 맞춰 알아서
const LENGTHS = [0, 800, 1000, 1500] as const
type Len = (typeof LENGTHS)[number]
const LEN_KEY = 'press-bulk-length'

export type AiUsageLine = { used: number; limit: number | null; mineUsed: number | null; mineLimit: number | null }

export default function PressBulkList({ rows, canHide = false, hiddenView = false, aiUsage = null }: { rows: BulkRow[]; canHide?: boolean; hiddenView?: boolean; aiUsage?: AiUsageLine | null }) {
  const t = useT()
  const router = useRouter()
  const [hiding, setHiding] = useState(false)
  const [hideNote, setHideNote] = useState('')
  const { job, start, clear } = useBulkAi()
  const [picked, setPicked] = useState<string[]>([])
  // 만드는 일은 편집국 전체(BulkAiProvider)에서 돌아서, 다른 메뉴에 갔다 와도 계속되고 여기서 진행·결과가 이어서 보인다
  const running = !!job?.running
  const progress = job?.running ? { done: job.done, total: job.total, title: job.title } : null
  const results = job?.results ?? []

  const usable = rows.filter((r) => !r.used)
  const cap = canHide ? HIDE_MAX : MAX
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= cap ? cur : [...cur, id]))
  // AI 기사로 만들 수 있는 것: 이미 기사로 쓴 자료는 뺀다
  const usedIds = new Set(rows.filter((r) => r.used).map((r) => r.id))
  const aiIds = picked.filter((id) => !usedIds.has(id))
  const titleOf = (id: string) => rows.find((r) => r.id === id)?.title ?? ''
  const [len, setLen] = useState<Len>(0)
  // 마지막으로 고른 분량을 기억한다 (이 브라우저에만)
  useEffect(() => {
    try { const v = Number(localStorage.getItem(LEN_KEY)); if ((LENGTHS as readonly number[]).includes(v)) setLen(v as Len) } catch { /* 저장소를 못 써도 괜찮다 */ }
  }, [])
  const pickLen = (v: Len) => { setLen(v); try { localStorage.setItem(LEN_KEY, String(v)) } catch { /* 무시 */ } }

  const run = () => {
    const ids = aiIds.slice(0, MAX)
    if (!ids.length || running || aiIds.length > MAX) return
    const ok = start(ids, Object.fromEntries(ids.map((id) => [id, titleOf(id)])), len || undefined)
    if (ok) setPicked([])
  }

  const okCount = results.filter((r) => r.ok).length

  // 맞춤 자료에서 가리기 / 가린 자료 되돌리기 (편집장 이상). 원본은 지우지 않는다
  const hideRun = async () => {
    if (!picked.length || hiding) return
    const msg = hiddenView
      ? t(`선택한 ${picked.length}건을 맞춤 자료에 다시 나오게 할까요?`, `Restore the ${picked.length} selected releases to My feed?`)
      : t(`선택한 ${picked.length}건을 맞춤 자료에서 가릴까요?\n보도자료 원본은 지워지지 않고, 이 매체의 맞춤 자료에서만 안 보입니다. 위쪽 “가린 자료 보기”에서 되돌릴 수 있습니다.`, `Hide the ${picked.length} selected releases from My feed?\nThe releases themselves are not deleted; they are only hidden for this outlet. You can restore them under “View / restore hidden”.`)
    if (!window.confirm(msg)) return
    setHiding(true)
    setHideNote('')
    const r = await hidePress(picked, hiddenView)
    setHiding(false)
    if (r.error) { setHideNote(r.error); return }
    setPicked([])
    setHideNote(hiddenView ? t(`${r.n ?? 0}건을 되돌렸습니다.`, `${r.n ?? 0} restored.`) : t(`${r.n ?? 0}건을 가렸습니다.`, `${r.n ?? 0} hidden.`))
    router.refresh()
  }

  return (
    <div>
      <div className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur md:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
          {/* 1) 고르기 */}
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-semibold text-ink tabular-nums" aria-live="polite">{t(`${picked.length}/${cap}건 선택`, `${picked.length}/${cap} selected`)}</span>
            <button type="button" disabled={running || usable.length === 0} onClick={() => setPicked(usable.slice(0, MAX).map((r) => r.id))} className="btn-secondary px-3 py-1 text-[12px] disabled:opacity-40">{t(`위에서 ${MAX}건`, `First ${MAX}`)}</button>
            {picked.length > 0 && !running && <button type="button" onClick={() => setPicked([])} className="text-[12px] text-muted underline">{t('모두 해제', 'Clear')}</button>}
          </div>
          {/* 2) 기사 분량 */}
          {!hiddenView && <div className="flex items-center gap-2" role="group" aria-label={t('기사 분량', 'Story length')}>
            <span className="text-[12px] text-muted">{t('분량', 'Length')}</span>
            <div className="inline-flex overflow-hidden rounded border border-line text-[12px]">
              {LENGTHS.map((v) => (
                <button key={v} type="button" disabled={running} onClick={() => pickLen(v)} aria-pressed={len === v}
                  className={`px-2.5 py-1 tabular-nums transition-colors disabled:opacity-50 ${len === v ? 'bg-ink font-semibold text-white' : 'bg-white text-ink hover:bg-[#F1F3F2]'}`}>
                  {v === 0 ? t('자동', 'Auto') : t(`${v.toLocaleString('ko-KR')}자`, `~${v.toLocaleString('en-US')}`)}
                </button>
              ))}
            </div>
          </div>}
          {/* 3) 만들기 · 가리기 */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canHide && (
              <button type="button" disabled={picked.length === 0 || hiding || running} onClick={hideRun} className="btn-secondary px-3 py-1.5 text-[12.5px] disabled:opacity-40">
                {hiding ? t('처리 중…', 'Working…') : hiddenView ? t(`선택한 ${picked.length}건 되돌리기`, `Restore ${picked.length}`) : t(`선택한 ${picked.length}건 가리기`, `Hide ${picked.length}`)}
              </button>
            )}
            {!hiddenView && (
              <button type="button" disabled={aiIds.length === 0 || aiIds.length > MAX || running} onClick={run} className="btn-primary px-3.5 py-1.5 text-[12.5px] disabled:opacity-40" title={aiIds.length > MAX ? t(`AI 기사 만들기는 한 번에 ${MAX}건까지입니다`, `AI stories: up to ${MAX} at a time`) : undefined}>
                {running ? t('만드는 중…', 'Creating…') : t(`AI 기사로 만들어 승인대기로${aiIds.length ? ` (${aiIds.length}건)` : ''}`, `Create AI stories → pending review${aiIds.length ? ` (${aiIds.length})` : ''}`)}
              </button>
            )}
          </div>
        </div>
        {hideNote && <p role="status" className="mt-2 text-[12.5px] font-semibold text-ink">{hideNote}</p>}
        {!hiddenView && aiUsage && aiUsage.limit != null && (
          <p className={`mt-2 text-[12.5px] font-semibold ${aiUsage.used >= aiUsage.limit ? 'text-danger' : aiUsage.used >= aiUsage.limit * 0.8 ? 'text-draft' : 'text-ink'}`} role="status">
            {t(`이번 달 AI 사용 ${aiUsage.used.toLocaleString()}/${aiUsage.limit.toLocaleString()}회`, `AI used this month: ${aiUsage.used.toLocaleString()} / ${aiUsage.limit.toLocaleString()}`)}
            <span className="ml-1.5 font-normal text-muted">
              {aiUsage.used >= aiUsage.limit
                ? t('(한도를 다 썼습니다)', '(limit reached)')
                : t(`(초안·법적 검수 합계 · ${(aiUsage.limit - aiUsage.used).toLocaleString()}회 남음)`, `(drafts + legal checks · ${(aiUsage.limit - aiUsage.used).toLocaleString()} left)`)}
              {aiUsage.mineLimit != null && <> · {t(`내 몫 ${(aiUsage.mineUsed ?? 0).toLocaleString()}/${aiUsage.mineLimit.toLocaleString()}회`, `Mine ${(aiUsage.mineUsed ?? 0).toLocaleString()} / ${aiUsage.mineLimit.toLocaleString()}`)}</>}
            </span>
          </p>
        )}
        {!hiddenView && <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          {t('체크한 보도자료를 AI가 기사 초안으로 써서 승인대기로 보냅니다. 발행은 편집장이 확인한 뒤에 합니다. 원문이 짧으면 분량을 채우려고 내용을 지어내지 않고 짧게 씁니다.', 'AI writes a draft story from each checked release and sends it to pending review; an editor publishes after checking. If the source is short, the draft stays short rather than inventing content.')}
        </p>}
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
              {!progress && <button type="button" onClick={clear} className="float-right ml-2 text-muted underline">{t('결과 지우기', 'Clear')}</button>}
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
                <input type="checkbox" disabled={(r.used && !canHide) || running} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={t(`${r.title} 선택`, `Select ${r.title}`)} className="mt-1" />
              </label>
              <Link href={`/press/${r.id}`} className="block min-w-0 flex-1 px-3 py-4 md:pr-5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
                  {r.badges.map((b) => <span key={b} className="rounded bg-ink/10 px-1.5 py-0.5 font-semibold text-ink">{b}</span>)}
                  {r.chars !== null && <span className="tabular-nums" title={t('본문 글자 수(공백 제외)', 'Body characters (no spaces)')}>{r.chars.toLocaleString()}{t('자', ' chars')}</span>}
                  <span className="rounded bg-line/70 px-1.5 py-0.5">{r.sourceName}</span>
                  <time className="tabular-nums" dateTime={r.dateIso ?? undefined}>{r.date}</time>
                  {r.used && <span className="rounded bg-published/10 px-1.5 py-0.5 font-semibold text-published">{t('기사화됨', 'Story created')}</span>}
                </div>
                <p className="mt-1.5 text-[15px] font-semibold leading-snug">{r.title}{r.photos > 0 && <span className="ml-1.5 inline-flex translate-y-[2px] items-center gap-0.5 align-baseline text-[12px] font-normal text-muted" title={t('사진 있음', 'Has photo')}><ImageIcon />{r.photos > 1 && <span className="tabular-nums">{r.photos}</span>}</span>}</p>
                {r.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{r.summary}</p>}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
