'use client'

import { useState, useTransition } from 'react'
import { addLaunchComment, deleteLaunchComment } from '@/app/(main)/support/onboarding/actions'

export type LaunchComment = { id: string; step_id: string | null; author_name: string; from_staff: boolean; body: string; created_at: string }

const when = (t: string) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

// 개통 진행 현황의 코멘트: 단계마다(또는 전체 문의로) 고객과 운영팀이 주고받는다
export default function LaunchComments({ outletId, stepId, initial, staff, title, hint, defaultOpen = false }: {
  outletId: string; stepId: string | null; initial: LaunchComment[]; staff: boolean; title: string; hint?: string; defaultOpen?: boolean
}) {
  const [list, setList] = useState(initial)
  const [open, setOpen] = useState(defaultOpen || initial.length > 0 && !staff)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const unseenFromCustomer = staff ? list.filter((c) => !c.from_staff).length : 0

  function send() {
    setError('')
    start(async () => {
      const r = await addLaunchComment(outletId, stepId, text)
      if (r.error || !r.comment) { setError(r.error ?? '저장하지 못했습니다.'); return }
      setList((l) => [...l, r.comment!]); setText('')
    })
  }
  function remove(id: string) {
    if (!window.confirm('이 코멘트를 지울까요?')) return
    start(async () => {
      const r = await deleteLaunchComment(id)
      if (r.error) { setError(r.error); return }
      setList((l) => l.filter((c) => c.id !== id))
    })
  }

  return (
    <div className="mt-4 border-t border-dashed border-[#E3E6EB] pt-3">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 text-left text-[13px] font-bold">
        <span aria-hidden>💬</span>
        <span>{title}</span>
        {list.length > 0 && <span className="rounded-full bg-[#E8F0FE] px-2 text-[11.5px] tabular-nums text-[#1F55C9]">{list.length}</span>}
        <span className="ml-auto text-[12px] font-normal text-muted">{open ? '접기 ▲' : '쓰기·보기 ▼'}</span>
      </button>
      {open && (
        <div className="mt-3">
          {hint && !list.length && <p className="mb-2 text-[12.5px] text-muted">{hint}</p>}
          {list.length > 0 && (
            <ul className="mb-3 space-y-2">
              {list.map((c) => (
                <li key={c.id} className={`rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${c.from_staff ? 'bg-[#EEF3F9]' : 'bg-[#FFF8E8]'}`}>
                  <div className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                    <strong className="text-ink">{c.author_name || (c.from_staff ? '운영팀' : '고객')}</strong>
                    <span className={`rounded px-1.5 py-px text-[11px] font-bold ${c.from_staff ? 'bg-[#2F6BF0] text-white' : 'bg-[#F2B544] text-[#14171C]'}`}>{c.from_staff ? 'IM 뉴스룸' : '고객'}</span>
                    <time className="tabular-nums">{when(c.created_at)}</time>
                    {staff && <button type="button" onClick={() => remove(c.id)} disabled={pending} className="ml-auto text-[11.5px] underline underline-offset-2 hover:text-danger">지우기</button>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder={staff ? '고객에게 답하거나 안내할 내용을 적어 주세요.' : '궁금한 점이나 전달할 내용을 적어 주세요. 담당 매니저가 확인하고 이곳에 답합니다.'} className="field-input w-full resize-y bg-white py-2 text-[13.5px]" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" disabled={pending || !text.trim()} onClick={send} className="btn-primary px-4 py-1.5 text-[13px] disabled:opacity-40">{pending ? '보내는 중…' : staff ? '답하기' : '남기기'}</button>
            {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
            {staff && unseenFromCustomer > 0 && <span className="text-[12px] text-muted">고객 글 {unseenFromCustomer}건</span>}
          </div>
        </div>
      )}
    </div>
  )
}
