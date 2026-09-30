'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addReply } from '@/app/(main)/support/actions'
import { uploadSupportFiles } from './support-upload'
import FilePicker from './FilePicker'

export default function ReplyBox({ ticketId, isStaff }: { ticketId: string; isStaff: boolean }) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await addReply(ticketId, body)
    if (res.error || !res.id) { setError(res.error ?? '저장하지 못했습니다.'); setBusy(false); return }
    const failed = files.length ? await uploadSupportFiles(ticketId, res.id, files) : []
    if (failed.length) window.alert(`올리지 못한 파일: ${failed.join(', ')}`)
    setBody('')
    setFiles([])
    setBusy(false)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-black/5">
      <label htmlFor="reply" className="text-[14px] font-bold">{isStaff ? '운영팀 답변 쓰기' : '추가 문의 · 답글'}</label>
      <textarea id="reply" value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder={isStaff ? '답변을 적어주세요. 첫 답변을 달면 상태가 “진행”으로 바뀝니다.' : '추가로 알려줄 내용이 있으면 적어주세요.'} className="field-input resize-y leading-relaxed" />
      <FilePicker files={files} setFiles={setFiles} />
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={busy || !body.trim()} className="rounded-full bg-[#2F6BF0] px-6 py-2 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? '보내는 중…' : '등록'}
        </button>
      </div>
    </form>
  )
}
