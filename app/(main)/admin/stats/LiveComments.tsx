'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useCmsLang, useT } from '@/components/cms/CmsLang'
import { HOLD_LABEL } from '@/lib/comment-screen'
import { approveFeed, banGuestFeed, banReaderFeed, deleteFeed, fetchFeed, hideFeed, replyFeed, type FeedRow, type FeedTab } from './actions'

const POLL_MS = 20_000

// 편집국 통계 화면의 실시간 댓글: 20초마다 새 댓글을 가져와 보여 주고, 승인·숨기기·삭제·차단·답글을 바로 한다
export default function LiveComments({ initial, initialPending, initialError }: { initial: FeedRow[]; initialPending: number; initialError?: boolean }) {
  const t = useT()
  const lang = useCmsLang()
  const [tab, setTab] = useState<FeedTab>('new')
  const [rows, setRows] = useState<FeedRow[]>(initial)
  const [pending, setPending] = useState(initialPending)
  const [error, setError] = useState(!!initialError)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [reply, setReply] = useState<{ id: string; text: string } | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, start] = useTransition()
  const seen = useRef<Set<string>>(new Set(initial.map((r) => r.id)))
  const tabRef = useRef<FeedTab>('new')

  const load = useCallback(async (which: FeedTab, markNew: boolean) => {
    const r = await fetchFeed(which)
    if (r.error) { setError(true); return }
    setError(false)
    if (markNew) {
      const added = r.rows.filter((x) => !seen.current.has(x.id)).map((x) => x.id)
      if (added.length) setFresh((cur) => new Set([...cur, ...added]))
    }
    r.rows.forEach((x) => seen.current.add(x.id))
    setRows(r.rows)
    setPending(r.pending)
  }, [])

  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') void load(tabRef.current, true) }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [load])
  // 새 댓글이 대기 중이면 탭 제목에 개수를 보인다
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '')
    document.title = pending > 0 ? `(${pending}) ${base}` : base
    return () => { document.title = base }
  }, [pending])

  const act = (fn: () => Promise<{ ok?: boolean; error?: string }>, done?: string) => start(async () => {
    const r = await fn()
    if (r.error) setMsg(r.error)
    else { setMsg(done ?? ''); await load(tabRef.current, false) }
  })

  const ago = (iso: string) => {
    const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
    if (s < 60) return t('방금', 'just now')
    if (s < 3600) return t(`${Math.floor(s / 60)}분 전`, `${Math.floor(s / 60)}m ago`)
    if (s < 86400) return t(`${Math.floor(s / 3600)}시간 전`, `${Math.floor(s / 3600)}h ago`)
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { month: 'short', day: 'numeric' }).format(new Date(iso))
  }

  return (
    <section aria-labelledby="live-comments" className="rounded-lg border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="live-comments" className="text-[15px] font-bold">
          {t('실시간 댓글', 'Live comments')}
          {pending > 0 && <span className="ml-2 rounded-full bg-danger px-2 py-0.5 text-[11.5px] font-semibold text-white">{t(`대기 ${pending}`, `${pending} pending`)}</span>}
        </h2>
        <div className="flex gap-1 text-[12.5px]" role="tablist">
          {([['new', t('승인 대기', 'Pending')], ['all', t('최근 전체', 'Recent')]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setFresh(new Set()); void load(k, false) }}
              className={`rounded px-2.5 py-1 ${tab === k ? 'bg-ink font-semibold text-white' : 'text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </header>

      {error && <p className="px-4 py-6 text-[13px] text-muted">{t('댓글을 불러오지 못했습니다. 댓글 기능(comments.sql)이 아직 준비되지 않았거나 잠시 연결이 끊겼습니다.', 'Could not load comments. Comments (comments.sql) may not be set up yet, or the connection dropped.')}</p>}
      {!error && rows.length === 0 && <p className="px-4 py-10 text-center text-[13px] text-muted">{tab === 'new' ? t('승인을 기다리는 댓글이 없습니다. 새 댓글이 오면 여기에 바로 나타납니다.', 'No comments waiting. New comments appear here right away.') : t('댓글이 없습니다.', 'No comments.')}</p>}
      {msg && <p role="status" className="border-b border-line bg-paper px-4 py-2 text-[12.5px] text-danger">{msg}</p>}

      <ul className="max-h-[calc(100vh-14rem)] divide-y divide-line overflow-y-auto">
        {rows.map((c) => {
          const who = c.reader ? c.reader.name || c.reader.email.split('@')[0] : c.guest_name
          return (
            <li key={c.id} className={`px-4 py-3 text-[13px] ${fresh.has(c.id) ? 'bg-[#FFF8E1]' : ''}`}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                <strong className="text-ink">{who}</strong>
                {!c.reader && <span className="rounded bg-paper px-1.5">{t('비회원', 'Guest')}</span>}
                <span>· {ago(c.created_at)}</span>
                {c.status === 'pending' && <span className="rounded bg-draft/20 px-1.5 text-ink">{t('승인 대기', 'Pending')}</span>}
                {c.hold_reason && HOLD_LABEL[c.hold_reason] && <span className="rounded bg-draft/20 px-1.5 text-ink">{t(`자동 검사: ${HOLD_LABEL[c.hold_reason][0]}`, `Auto screen: ${HOLD_LABEL[c.hold_reason][1]}`)}</span>}
                {c.report_count > 0 && <span className="rounded bg-danger/10 px-1.5 text-danger">{t(`신고 ${c.report_count}`, `${c.report_count} report${c.report_count === 1 ? '' : 's'}`)}</span>}
              </p>
              {c.article && <p className="mt-0.5 text-[12px]"><Link href={`/articles/${c.article.id}`} className="text-review underline underline-offset-2">{c.article.title}</Link></p>}
              <p className="mt-1.5 whitespace-pre-line break-words text-[13.5px] leading-[1.6]">{c.body}</p>

              {c.replies.map((r) => (
                <p key={r.id} className="mt-1.5 rounded bg-paper px-2.5 py-1.5 text-[12.5px] leading-[1.55]"><strong>{r.staff_name || t('편집국', 'Newsroom')}</strong> <span className="text-muted">· {ago(r.created_at)}</span><br />{r.body}</p>
              ))}

              {reply?.id === c.id ? (
                <div className="mt-2 space-y-1.5">
                  <textarea value={reply.text} onChange={(e) => setReply({ id: c.id, text: e.target.value })} maxLength={500} rows={3} autoFocus
                    placeholder={t('독자에게 보일 답글 (편집국 표시와 함께 바로 공개됩니다)', 'Reply shown to readers (published right away, marked as Newsroom)')}
                    className="w-full rounded border border-line px-2.5 py-1.5 text-[13px]" />
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busy || !reply.text.trim()} className="btn-primary px-3 py-1 text-[12.5px] disabled:opacity-50"
                      onClick={() => act(async () => { const r = await replyFeed(c.id, reply.text); if (r.ok) setReply(null); return r }, t('답글을 올렸습니다.', 'Reply posted.'))}>{t('답글 올리기', 'Post reply')}</button>
                    <button type="button" className="text-[12.5px] text-muted underline underline-offset-2" onClick={() => setReply(null)}>{t('취소', 'Cancel')}</button>
                    <span className="ml-auto text-[11.5px] text-muted">{reply.text.length}/500</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {c.status !== 'approved' && <button type="button" disabled={busy} className="btn-primary px-3 py-1 text-[12.5px]" onClick={() => act(() => approveFeed(c.id))}>{t('승인', 'Approve')}</button>}
                  <button type="button" disabled={busy} className="btn-secondary px-3 py-1 text-[12.5px]" onClick={() => setReply({ id: c.id, text: '' })}>{t('답글', 'Reply')}</button>
                  <button type="button" disabled={busy} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => act(() => hideFeed(c.id))}>{c.status === 'approved' ? t('숨기기', 'Hide') : t('반려', 'Reject')}</button>
                  <button type="button" disabled={busy} className="text-[12.5px] text-danger underline underline-offset-2" onClick={() => { if (window.confirm(t('이 댓글을 지울까요?', 'Delete this comment?'))) act(() => deleteFeed(c.id)) }}>{t('삭제', 'Delete')}</button>
                  {c.reader && !c.reader.banned && (
                    <button type="button" disabled={busy} className="ml-auto text-[12.5px] text-muted underline underline-offset-2 hover:text-danger" onClick={() => { if (window.confirm(t('이 독자를 차단할까요? 쓴 댓글은 모두 반려됩니다.', 'Ban this reader? All of their comments will be rejected.'))) act(() => banReaderFeed(c.reader!.id)) }}>{t('독자 차단', 'Ban reader')}</button>
                  )}
                  {!c.reader && c.ip_hash && (
                    <button type="button" disabled={busy} className="ml-auto text-[12.5px] text-muted underline underline-offset-2 hover:text-danger" onClick={() => { if (window.confirm(t('이 비회원(같은 접속)을 차단할까요? 쓴 댓글은 모두 반려되고 더 쓸 수 없습니다.', 'Block this guest (same connection)? All of their comments will be rejected and they cannot post again.'))) act(() => banGuestFeed(c.outlet_id, c.ip_hash!)) }}>{t('비회원 차단', 'Block guest')}</button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <footer className="border-t border-line px-4 py-2 text-[12px] text-muted">
        {t('20초마다 새 댓글을 가져옵니다.', 'Checks for new comments every 20 seconds.')} <Link href="/admin/comments" className="underline underline-offset-2">{t('댓글 전체 보기', 'All comments')}</Link>
      </footer>
    </section>
  )
}
