'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aiTicketFeedback, deleteTicket, retryTicketAi } from '@/app/(main)/support/actions'
import { SUPPORT_LINKS } from '@/lib/support-ai-links'
import { useT } from '@/components/cms/CmsLang'

// AI 답글 본문: 편집국 주소(/articles/new 등)는 눌러서 가는 링크로
export function AiReplyBody({ body }: { body: string }) {
  const parts = body.split(/(\/[a-z][a-z0-9/_-]*)/g)
  return (
    <>
      {parts.map((p, i) => (p in SUPPORT_LINKS
        ? <Link key={i} href={p} className="font-semibold text-[#2F6BF0] underline underline-offset-2">{SUPPORT_LINKS[p]}</Link>
        : <Fragment key={i}>{p}</Fragment>))}
    </>
  )
}

// 요청한 사람: AI 안내로 해결됐는지
export function AiFeedback({ ticketId, state }: { ticketId: string; state: string }) {
  const [pending, start] = useTransition()
  const [cur, setCur] = useState(state)
  const router = useRouter()
  const t = useT()
  function send(solved: boolean) {
    start(async () => {
      const r = await aiTicketFeedback(ticketId, solved)
      if (r.error) { window.alert(r.error); return }
      if (r.state) setCur(r.state)
      router.refresh()
    })
  }
  if (cur === 'resolved') return <p className="mt-3 text-[13px] font-semibold text-published">{t('해결됨으로 표시했습니다. 요청은 완료로 닫혔습니다.', 'Marked as solved. The request has been closed as done.')}</p>
  if (cur === 'handoff') return <p className="mt-3 text-[13px] text-muted">{t('운영팀 담당자가 확인한 뒤 답변드립니다.', 'A team member will review it and reply.')}</p>
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => send(true)} className="rounded-full bg-published px-4 py-2 text-[13px] font-bold text-white hover:opacity-90">{t('해결됐어요', 'That solved it')}</button>
      <button type="button" disabled={pending} onClick={() => send(false)} className="rounded-full border border-line bg-white px-4 py-2 text-[13px] font-semibold hover:border-ink">{t('담당자 답변이 필요해요', 'I need an agent to reply')}</button>
    </div>
  )
}

// AI가 답을 만드는 동안: 몇 초마다 다시 읽는다 (1분까지)
export function AiWaiting() {
  const router = useRouter()
  const t = useT()
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (tries >= 15) return
    const t = setTimeout(() => { router.refresh(); setTries((n) => n + 1) }, 4000)
    return () => clearTimeout(t)
  }, [tries, router])
  if (tries >= 15) return null
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[#2F6BF0]/40 bg-[#2F6BF0]/5 px-5 py-4 text-[13.5px] text-[#2F6BF0]" role="status">
      <span className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[#2F6BF0] border-t-transparent" aria-hidden />
      {t('AI가 먼저 안내를 준비하고 있습니다… 운영팀에도 함께 전달되었습니다.', 'The AI is preparing a first reply… The team has been notified as well.')}
    </p>
  )
}

// 업무요청 지우기 (쓴 사람·총관리자)
export function DeleteTicketButton({ ticketId, answered }: { ticketId: string; answered: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  const t = useT()
  function remove() {
    const msg = t(`이 업무요청을 지울까요?${answered ? '\n달린 답변과 첨부파일도 함께 지워집니다.' : ''}\n지우면 되돌릴 수 없습니다.`, `Delete this support request?${answered ? '\nIts replies and attachments will be deleted too.' : ''}\nThis cannot be undone.`)
    if (!window.confirm(msg)) return
    start(async () => {
      const r = await deleteTicket(ticketId)
      if (r.error) { window.alert(r.error); return }
      router.push('/support/tickets')
      router.refresh()
    })
  }
  return (
    <button type="button" onClick={remove} disabled={pending} className="text-[13px] text-muted hover:text-danger disabled:opacity-50">
      {pending ? t('지우는 중…', 'Deleting…') : t('요청 삭제', 'Delete request')}
    </button>
  )
}

// 운영팀: AI 첫 답변 지금 만들기 (실패하면 이유를 보여 준다)
export function RetryAiButton({ ticketId }: { ticketId: string }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState('')
  const [failed, setFailed] = useState(false)
  const router = useRouter()
  const t = useT()
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => {
        setMsg('')
        const r = await retryTicketAi(ticketId)
        setFailed(!!r.error)
        setMsg(r.error ? `${t('AI 답변 못 함', 'AI reply failed')}: ${r.error}` : t('AI 답변을 달았습니다.', 'AI reply added.'))
        router.refresh()
      })} className="rounded-full bg-[#2F6BF0] px-3 py-1 text-[12px] font-bold text-white hover:opacity-90 disabled:opacity-60">
        {pending ? t('AI 답변 만드는 중… (최대 40초)', 'Generating AI reply… (up to 40 seconds)') : t('AI 답변 지금 만들기', 'Generate AI reply now')}
      </button>
      {msg && <span role="status" className={`text-[12px] ${failed ? 'text-danger' : 'text-published'}`}>{msg}</span>}
    </span>
  )
}
