'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket } from '@/app/(main)/support/actions'
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/support'
import { uploadSupportFiles } from './support-upload'
import FilePicker from './FilePicker'

const HINTS: Record<TicketCategory, string> = {
  content: '예) 기사 섹션을 옮겨주세요, 홈 편집판 배치가 안 됩니다',
  design: '예) 로고를 바꿔주세요, 배너 자리를 만들어주세요 (시안·이미지를 첨부해 주세요)',
  dev: '예) 이런 기능이 있으면 좋겠습니다',
  error: '예) ○○ 화면에서 저장이 안 됩니다 (어떤 화면에서 무엇을 눌렀는지, 화면 캡처를 첨부해 주세요)',
  billing: '예) 요금제 변경, 청구서 재발행, 계약자 변경',
  etc: '그 밖에 궁금한 점',
}

export default function TicketForm({ requesterName }: { requesterName: string }) {
  const router = useRouter()
  const [category, setCategory] = useState<TicketCategory | ''>('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await createTicket({ category, title, body })
    if (res.error || !res.id) { setError(res.error ?? '저장하지 못했습니다.'); setBusy(false); return }
    const failed = files.length ? await uploadSupportFiles(res.id, null, files) : []
    if (failed.length) window.alert(`요청은 접수됐지만 올리지 못한 파일이 있습니다: ${failed.join(', ')}`)
    router.push(`/support/tickets/${res.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl bg-white p-8 ring-1 ring-black/5">
      <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-center sm:gap-4">
        <span className="text-[14px] font-bold">요청인</span>
        <span className="w-fit rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-white">{requesterName}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-start sm:gap-4 border-t border-line pt-6">
        <span className="pt-1.5 text-[14px] font-bold">작업 유형</span>
        <div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="작업 유형">
            {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-1.5 text-[14px] font-semibold ${category === c ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
              >
                {TICKET_CATEGORIES[c]}
              </button>
            ))}
          </div>
          {category && <p className="mt-2 text-[12.5px] text-muted">{HINTS[category]}</p>}
        </div>
      </div>
      <div className="space-y-3 border-t border-line pt-6">
        <label htmlFor="t-title" className="sr-only">제목</label>
        <input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="제목을 입력해주세요" className="field-input py-3 text-[15px]" />
        <label htmlFor="t-body" className="sr-only">요청 내용</label>
        <textarea id="t-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder="요청 내용을 자세히 적어주세요. 어느 화면인지, 원하는 결과가 무엇인지 적어주시면 더 빨리 처리됩니다." className="field-input resize-y text-[14.5px] leading-relaxed" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-start sm:gap-4">
        <span className="pt-1.5 text-[14px] font-bold">파일 첨부</span>
        <FilePicker files={files} setFiles={setFiles} />
      </div>
      {error && <p role="alert" className="text-[14px] font-semibold text-danger">{error}</p>}
      <div className="flex justify-center pt-2">
        <button type="submit" disabled={busy} className="rounded-full bg-[#2F6BF0] px-16 py-3.5 text-[16px] font-bold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? (files.length ? '파일 올리는 중…' : '보내는 중…') : '작성완료'}
        </button>
      </div>
    </form>
  )
}
