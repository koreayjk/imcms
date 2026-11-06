'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createAiReviewArticle, type BulkResult } from '@/app/(main)/press/actions'
import { useT } from '@/components/cms/CmsLang'

// 보도자료 일괄 AI 기사 만들기를 "화면 하나"가 아니라 편집국 전체(레이아웃)에서 돌린다.
//   다른 메뉴로 갔다 와도(화면 안 이동) 계속 만들고, 돌아오면 진행·결과가 그대로 보인다.
//   새로고침·탭 닫기는 막을 수 없어서 만드는 중에는 닫기 전에 경고를 띄우고, 끝난 결과는 이 브라우저에 잠깐 기억해 둔다.
export const BULK_MAX = 10
const KEY = 'press-bulk-ai-job'

export type BulkJob = {
  total: number
  done: number            // 끝난(성공+실패) 건수
  title: string           // 지금 만드는 보도자료 제목
  running: boolean
  results: BulkResult[]
  interrupted?: boolean   // 새로고침 등으로 중간에 끊김
  dismissed?: boolean     // 하단 알림 닫음 (보도자료함 안에서는 계속 보임)
  at: number
}

type Ctx = {
  job: BulkJob | null
  start: (ids: string[], titles: Record<string, string>, length?: number) => boolean
  dismiss: () => void
  clear: () => void   // 결과를 완전히 지운다 (보도자료함의 결과 칸 닫기)
}
const BulkCtx = createContext<Ctx>({ job: null, start: () => false, dismiss: () => {}, clear: () => {} })
export const useBulkAi = () => useContext(BulkCtx)

export default function BulkAiProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [job, setJob] = useState<BulkJob | null>(null)
  const running = useRef(false)
  const save = (j: BulkJob | null) => { try { if (j) sessionStorage.setItem(KEY, JSON.stringify(j)); else sessionStorage.removeItem(KEY) } catch { /* 저장소를 못 써도 괜찮다 */ } }

  // 새로고침 뒤: 끝난 결과는 다시 보여 주고, 만드는 중이던 것은 "중간에 끊김"으로 표시한다
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY)
      if (!raw) return
      const j = JSON.parse(raw) as BulkJob
      if (Date.now() - j.at > 6 * 3600_000) { save(null); return }
      setJob(j.running ? { ...j, running: false, interrupted: true } : j)
    } catch { /* 무시 */ }
  }, [])

  // 만드는 중에 탭을 닫거나 새로고침하면 남은 건은 만들어지지 않는다
  useEffect(() => {
    if (!job?.running) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [job?.running])

  const update = useCallback((j: BulkJob) => { setJob(j); save(j) }, [])

  const start = useCallback((ids: string[], titles: Record<string, string>, length?: number) => {
    const list = ids.slice(0, BULK_MAX)
    if (!list.length || running.current) return false
    running.current = true
    void (async () => {
      let j: BulkJob = { total: list.length, done: 0, title: titles[list[0]] ?? '', running: true, results: [], at: Date.now() }
      update(j)
      for (let i = 0; i < list.length; i++) {
        j = { ...j, title: titles[list[i]] ?? '' }
        update(j)
        let r: BulkResult
        try { r = await createAiReviewArticle(list[i], length) } catch { r = { ok: false, id: list[i], title: titles[list[i]], error: '서버가 응답하지 않았습니다. 잠시 뒤 다시 시도해 주세요.' } }
        j = { ...j, done: i + 1, results: [...j.results, r] }
        update(j)
        if (r.stop) break   // 한도를 다 썼거나 매체가 없으면 더 하지 않는다
      }
      j = { ...j, running: false, title: '' }
      update(j)
      running.current = false
      router.refresh()
    })()
    return true
  }, [router, update])

  const dismiss = useCallback(() => setJob((cur) => {
    if (!cur) return cur
    const n = { ...cur, dismissed: true }
    save(n)
    return n
  }), [])

  const clear = useCallback(() => setJob((cur) => {
    if (cur?.running) return cur
    save(null)
    return null
  }), [])

  return (
    <BulkCtx.Provider value={{ job, start, dismiss, clear }}>
      {children}
      <BulkAiPill />
    </BulkCtx.Provider>
  )
}

// 화면 어디서나 보이는 작은 진행 알림 (보도자료함 화면에서는 자체 진행 패널이 있어 숨긴다)
function BulkAiPill() {
  const t = useT()
  const { job, dismiss } = useBulkAi()
  const [path, setPath] = useState('')
  useEffect(() => { setPath(window.location.pathname) })
  if (!job || (job.dismissed && !job.running) || path.startsWith('/press') && !path.startsWith('/press/')) return null
  const ok = job.results.filter((r) => r.ok).length
  return (
    <div role="status" className="fixed bottom-[calc(68px+env(safe-area-inset-bottom))] right-3 z-50 max-w-[min(92vw,360px)] rounded-lg border border-line bg-white px-3.5 py-2.5 text-[12.5px] shadow-lg md:bottom-4 md:right-4 print:hidden">
      {job.running ? (
        <>
          <p className="font-semibold">{t(`AI 기사 만드는 중 ${Math.min(job.done + 1, job.total)}/${job.total}`, `Creating AI stories ${Math.min(job.done + 1, job.total)}/${job.total}`)}</p>
          {job.title && <p className="mt-0.5 line-clamp-1 text-muted">{job.title}</p>}
          <p className="mt-1 text-[11.5px] text-muted">{t('다른 메뉴로 이동해도 계속 만듭니다. 창을 닫거나 새로고침하지 마세요.', 'It keeps going while you browse. Do not close or refresh the window.')}</p>
          <Link href="/press" className="mt-1 inline-block text-[12px] font-semibold underline">{t('보도자료함에서 보기', 'View in Press')}</Link>
        </>
      ) : (
        <>
          <p className="font-semibold">{job.interrupted ? t(`중간에 끊겼습니다 · ${ok}건 승인대기로 올렸습니다`, `Interrupted · ${ok} sent to pending review`) : t(`${ok}건을 승인대기로 올렸습니다${job.results.length > ok ? ` (실패 ${job.results.length - ok}건)` : ''}`, `${ok} stories sent to pending review${job.results.length > ok ? ` (${job.results.length - ok} failed)` : ''}`)}</p>
          <div className="mt-1 flex items-center gap-3 text-[12px]">
            <Link href="/articles" className="font-semibold underline">{t('기사 목록에서 확인', 'See them in Stories')}</Link>
            <Link href="/press" className="underline">{t('결과 자세히', 'Details')}</Link>
            <button type="button" onClick={dismiss} className="ml-auto text-muted underline">{t('닫기', 'Close')}</button>
          </div>
        </>
      )}
    </div>
  )
}
