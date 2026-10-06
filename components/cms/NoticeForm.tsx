'use client'

import { useActionState } from 'react'
import { saveNotice, type FormState } from '@/app/(main)/support/actions'
import { NOTICE_CATEGORIES, type NoticeCategory } from '@/lib/support'
import PendingButton from './PendingButton'

type Notice = { id: string; category: string; title: string; body: string; pinned: boolean }

export default function NoticeForm({ notice }: { notice?: Notice }) {
  const [state, action] = useActionState<FormState, FormData>(saveNotice.bind(null, notice?.id ?? null), {})
  return (
    <form action={action} className="space-y-4 rounded-2xl bg-white p-7 ring-1 ring-black/5">
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-[14px] font-bold" htmlFor="n-cat">분류</label>
        <select id="n-cat" name="category" defaultValue={notice?.category ?? 'notice'} className="field-input w-40">
          {(Object.keys(NOTICE_CATEGORIES) as NoticeCategory[]).map((c) => <option key={c} value={c}>{NOTICE_CATEGORIES[c].label}</option>)}
        </select>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" name="pinned" defaultChecked={notice?.pinned} /> 맨 위에 고정
        </label>
      </div>
      <label htmlFor="n-title" className="sr-only">제목</label>
      <input id="n-title" name="title" defaultValue={notice?.title} required maxLength={200} placeholder="공지 제목" className="field-input py-3 text-[15px]" />
      <label htmlFor="n-body" className="sr-only">내용</label>
      <textarea id="n-body" name="body" defaultValue={notice?.body} required rows={14} placeholder="모든 회원사에 보이는 공지입니다." className="field-input resize-y leading-relaxed" />
      {state.error && <p role="alert" className="text-[13.5px] text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <PendingButton pending="저장 중…" className="rounded-full bg-[#2F6BF0] px-8 py-2.5 text-[14.5px] font-bold text-white hover:opacity-90">{notice ? '수정 저장' : '공지 올리기'}</PendingButton>
      </div>
    </form>
  )
}
