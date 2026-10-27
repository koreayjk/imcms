'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUS, feedbackCategoryLabel, feedbackStatusLabel, type FeedbackStatus } from '@/lib/feedback'
import { useCmsLang, useT } from '@/components/cms/CmsLang'
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
  const t = useT()
  const lang = useCmsLang()

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
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('분류', 'Category')}>
        {Object.keys(FEEDBACK_CATEGORIES).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={v.category === k} onClick={() => setV({ ...v, category: k })}
            className={`rounded-full border px-3 py-1 text-[13px] ${v.category === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>
            {feedbackCategoryLabel(k, lang)}
          </button>
        ))}
      </div>
      <div>
        <label htmlFor="fb-title" className="field-label">{t('제목', 'Title')}</label>
        <input id="fb-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} required
          placeholder={t('예) 기사목록에서 여러 기사를 한 번에 지우고 싶어요', 'e.g. I want to delete several stories at once from the story list')} className="field-input" />
      </div>
      <div>
        <label htmlFor="fb-body" className="field-label">{t('내용', 'Details')}</label>
        <textarea id="fb-body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={5000} required rows={6}
          placeholder={t('어느 화면에서, 무엇이 불편한지, 어떻게 되면 좋을지 적어 주세요.\n오류라면 언제·어떤 버튼을 눌렀을 때인지 함께 적어 주시면 빨리 고칠 수 있습니다.', 'Tell us which screen, what is hard to use, and how it could be better.\nFor a bug, please also say when it happened and which button you pressed so we can fix it quickly.')}
          className="field-input resize-y leading-relaxed" />
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        {onDone && <button type="button" onClick={onDone} className="btn-secondary">{t('취소', 'Cancel')}</button>}
        <button type="submit" disabled={pending || !v.title.trim() || !v.body.trim()} className="btn-primary">{pending ? t('저장 중…', 'Saving…') : postId ? t('고친 내용 저장', 'Save changes') : t('올리기', 'Post')}</button>
      </div>
    </form>
  )
}

// 목록 위 '개선 요청 쓰기' 열고 닫기
export function NewFeedback() {
  const [open, setOpen] = useState(false)
  const t = useT()
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-primary shrink-0 px-4 py-2.5 md:px-5">{t('+ 개선 요청 쓰기', '+ New request')}</button>
  return (
    <section className="w-full rounded-lg border border-line bg-white p-4 md:p-5" aria-label={t('개선 요청 쓰기', 'New improvement request')}>
      <h2 className="mb-3 text-[15px] font-bold">{t('개선 요청 쓰기', 'New improvement request')}</h2>
      <FeedbackForm onDone={() => setOpen(false)} />
    </section>
  )
}

// 글 본문 + 고치기·지우기 (쓴 사람·총관리자)
export function FeedbackPost({ id, initial, canEdit, children }: { id: string; initial: Draft; canEdit: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const t = useT()

  function remove() {
    if (!window.confirm(t('이 개선 요청을 지울까요? 달린 댓글도 함께 지워지고 되돌릴 수 없습니다.', 'Delete this request? Its comments will be deleted too, and this cannot be undone.'))) return
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
          <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink">{t('수정', 'Edit')}</button>
          <button type="button" onClick={remove} disabled={pending} className="text-muted hover:text-danger">{pending ? t('지우는 중…', 'Deleting…') : t('삭제', 'Delete')}</button>
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
  const lang = useCmsLang()
  const t = useT()
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
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t('처리 상태', 'Status')}>
      {(Object.keys(FEEDBACK_STATUS) as FeedbackStatus[]).map((s) => (
        <button key={s} type="button" role="radio" aria-checked={cur === s} disabled={pending} onClick={() => pick(s)}
          className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition ${cur === s ? `${FEEDBACK_STATUS[s].className} border-current` : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>
          {feedbackStatusLabel(s, lang)}
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
  const t = useT()

  function save() {
    start(async () => {
      const r = await updateFeedbackComment(id, text)
      if (r.error) { window.alert(r.error); return }
      setEditing(false)
      router.refresh()
    })
  }
  function remove() {
    if (!window.confirm(t('이 댓글을 지울까요?', 'Delete this comment?'))) return
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
          <label htmlFor={`c-${id}`} className="sr-only">{t('댓글 고치기', 'Edit comment')}</label>
          <textarea id={`c-${id}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3} className="field-input resize-y" autoFocus />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setText(body) }} className="btn-secondary py-1.5">{t('취소', 'Cancel')}</button>
            <button type="button" onClick={save} disabled={pending || !text.trim()} className="btn-primary py-1.5">{pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-relaxed">{body}</p>
          {canEdit && (
            <div className="mt-1.5 flex gap-3 text-[12px]">
              <button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-ink">{t('수정', 'Edit')}</button>
              <button type="button" onClick={remove} disabled={pending} className="text-muted hover:text-danger">{t('삭제', 'Delete')}</button>
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
  const t = useT()
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
      <label htmlFor="fb-comment" className="sr-only">{t('댓글', 'Comment')}</label>
      <textarea id="fb-comment" value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3}
        placeholder={t('의견을 남겨 주세요', 'Leave a comment')} className="field-input resize-y" />
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={pending || !text.trim()} className="btn-primary">{pending ? t('올리는 중…', 'Posting…') : t('댓글 달기', 'Post comment')}</button>
      </div>
    </form>
  )
}
