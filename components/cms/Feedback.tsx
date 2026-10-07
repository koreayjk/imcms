'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUS, type FeedbackStatus } from '@/lib/feedback'
import {
  addFeedbackComment, createFeedback, deleteFeedback, deleteFeedbackComment,
  setFeedbackStatus, updateFeedback, updateFeedbackComment,
} from '@/app/(main)/feedback/actions'

type Draft = { category: string; title: string; body: string }

// 글쓰기·고치기 양식
export function FeedbackForm({ initial, postId, onDone }: { initial?: Draft; postId?: string; onDone?: () => void }) {
  const [v, setV] = useState<Draft>(initial ?? { category: 'improve', title: '', body: '' })
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = postId ? await updateFeedback(postId, v) : await createFeedback(v)
      if (r.error) { setError(r.error); return }
      if (!postId && r.id) router.push(`/feedback/${r.id}`)
      else { router.refresh(); onDone?.() }
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="분류">
        {Object.entries(FEEDBACK_CATEGORIES).map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={v.category === k} onClick={() => setV({ ...v, category: k })}
            className={`rounded-full border px-3 py-1 text-[13px] ${v.category === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="fb-title" className="field-label">제목</label>
        <input id="fb-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} required
          placeholder="예) 기사목록에서 여러 기사를 한 번에 지우고 싶어요" className="field-input" />
      </div>
      <div>
        <label htmlFor="fb-body" className="field-label">내용</label>
        <textarea id="fb-body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={5000} required rows={6}
          placeholder={'어느 화면에서, 무엇이 불편한지, 어떻게 되면 좋을지 적어 주세요.\n오류라면 언제·어떤 버튼을 눌렀을 때인지 함께 적어 주시면 빨리 고칠 수 있습니다.'}
          className="field-input resize-y leading-relaxed" />
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && <button type="button" onClick={onDone} className="btn-secondary">취소</button>}
        <button type="submit" disabled={pending || !v.title.trim() || !v.body.trim()} className="btn-primary">{pending ? '저장 중…' : postId ? '고친 내용 저장' : '올리기'}</button>
      </div>
    </form>
  )
}

// 목록 위 '개선 요청 쓰기' 열고 닫기
export function NewFeedback() {
  const [open, setOpen] = useState(false)
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0 px-4 py-2.5 md:px-5">+ 개선 요청 쓰기</button>
  return (
    <section className="w-full rounded-lg border border-line bg-white p-4 md:p-5" aria-label="개선 요청 쓰기">
      <h2 className="mb-3 text-[15px] font-bold">개선 요청 쓰기</h2>
      <FeedbackForm onDone={() => setOpen(false)} />
    </section>
  )
}

// 글 본문 + 고치기·지우기 (쓴 사람·총관리자)
export function FeedbackPost({ id, initial, canEdit, children }: { id: string; initial: Draft; canEdit: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  function remove() {
    if (!window.confirm('이 개선 요청을 지울까요? 달린 댓글도 함께 지워지고 되돌릴 수 없습니다.')) return
    start(async () => {
      const r = await deleteFeedback(id)
      if (r.error) { window.alert(r.error); return }
      router.push('/feedback')
      router.refresh()
    })
  }

  if (editing) return <div className="mt-5"><FeedbackForm initial={initial} postId={id} onDone={() => setEditing(false)} /></div>
  return (
    <>
      {children}
      {canEdit && (
        <div className="mt-5 flex justify-end gap-3 text-[13px]">
          <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink">수정</button>
          <button type="button" onClick={remove} disabled={pending} className="text-muted hover:text-danger">{pending ? '지우는 중…' : '삭제'}</button>
        </div>
      )}
    </>
  )
}

// 상태 바꾸기 (운영팀)
export function FeedbackStatusPicker({ id, status }: { id: string; status: FeedbackStatus }) {
  const [pending, start] = useTransition()
  const [cur, setCur] = useState(status)
  const router = useRouter()
  function pick(s: FeedbackStatus) {
    if (s === cur) return
    const before = cur
    setCur(s)
    start(async () => {
      const r = await setFeedbackStatus(id, s)
      if (r.error) { setCur(before); window.alert(r.error); return }
      router.refresh()
    })
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="처리 상태">
      {(Object.keys(FEEDBACK_STATUS) as FeedbackStatus[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={cur === s} disabled={pending} onClick={() => pick(s)}
          className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition ${cur === s ? `${FEEDBACK_STATUS[s].className} border-current` : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>
          {FEEDBACK_STATUS[s].label}
        </button>
      ))}
    </div>
  )
}

// 댓글 한 개
export function FeedbackComment({ id, body, canEdit, children }: { id: string; body: string; canEdit: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(body)
  const [pending, start] = useTransition()
  const router = useRouter()

  function save() {
    start(async () => {
      const r = await updateFeedbackComment(id, text)
      if (r.error) { window.alert(r.error); return }
      setEditing(false)
      router.refresh()
    })
  }
  function remove() {
    if (!window.confirm('이 댓글을 지울까요?')) return
    start(async () => {
      const r = await deleteFeedbackComment(id)
      if (r.error) { window.alert(r.error); return }
      router.refresh()
    })
  }

  return (
    <div>
      {children}
      {editing ? (
        <div className="mt-2 space-y-2">
          <label htmlFor={`c-${id}`} className="sr-only">댓글 고치기</label>
          <textarea id={`c-${id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3} className="field-input resize-y" autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setText(body) }} className="btn-secondary py-1.5">취소</button>
            <button type="button" onClick={save} disabled={pending || !text.trim()} className="btn-primary py-1.5">{pending ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-relaxed">{body}</p>
          {canEdit && (
            <div className="mt-1.5 flex gap-3 text-[12px]">
              <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink">수정</button>
              <button type="button" onClick={remove} disabled={pending} className="text-muted hover:text-danger">삭제</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// 댓글 쓰기
export function FeedbackCommentBox({ postId }: { postId: string }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const router = useRouter()
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    start(async () => {
      const r = await addFeedbackComment(postId, text)
      if (r.error) { setError(r.error); return }
      setText('')
      router.refresh()
    })
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="fb-comment" className="sr-only">댓글</label>
      <textarea id="fb-comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3}
        placeholder="의견을 남겨 주세요" className="field-input resize-y" />
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary">{pending ? '올리는 중…' : '댓글 달기'}</button>
      </div>
    </form>
  )
}
