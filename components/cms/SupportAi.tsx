'use client'

import { Fragment, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { aiTicketFeedback, deleteTicket } from '@/app/(main)/support/actions'
import { SUPPORT_LINKS } from '@/lib/support-ai-links'

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
  function send(solved: boolean) {
    start(async () => {
      const r = await aiTicketFeedback(ticketId, solved)
      if (r.error) { window.alert(r.error); return }
      if (r.state) setCur(r.state)
      router.refresh()
    })
  }
  if (cur === 'resolved') return <p className="mt-3 text-[13px] font-semibold text-published">해결됨으로 표시했습니다. 요청은 완료로 닫혔습니다.</p>
  if (cur === 'handoff') return <p className="mt-3 text-[13px] text-muted">운영팀 담당자가 확인한 뒤 답변드립니다.</p>
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => send(true)} className="rounded-full bg-published px-4 py-2 text-[13px] font-bold text-white hover:opacity-90">해결됐어요</button>
      <button type="button" disabled={pending} onClick={() => send(false)} className="rounded-full border border-line bg-white px-4 py-2 text-[13px] font-semibold hover:border-ink">담당자 답변이 필요해요</button>
    </div>
  )
}

// AI가 답을 만드는 동안: 몇 초마다 다시 읽는다 (1분까지)
export function AiWaiting() {
  const router = useRouter()
  const [tries, setTries] = useState(0)
  useEffect(() => {
    if (tries >= 15) return
    const t = setTimeout(() => { router.refresh(); setTries((n) => n + 1) }, 4000)
    return () => clearTimeout(t)
  }, [tries, router])
  if (tries >= 15) return null
  return (
    <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[#2F6BF0]/40 bg-[#2F6BF0]/5 px-5 py-4 text-[13.5px] text-[#2F6BF0]" role="status">
      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#2F6BF0] border-t-transparent" aria-hidden />
      AI가 먼저 안내를 준비하고 있습니다… 운영팀에도 함께 전달되었습니다.
    </p>
  )
}

// 업무요청 지우기 (쓴 사람·총관리자)
export function DeleteTicketButton({ ticketId, answered }: { ticketId: string; answered: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()
  function remove() {
    const msg = `이 업무요청을 지울까요?${answered ? '\n달린 답변과 첨부파일도 함께 지워집니다.' : ''}\n지우면 되돌릴 수 없습니다.`
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
      {pending ? '지우는 중…' : '요청 삭제'}
    </button>
  )
}
