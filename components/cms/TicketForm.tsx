'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTicket, sendStaffMessage } from '@/app/(main)/support/actions'
import { TICKET_CATEGORIES, type TicketCategory } from '@/lib/support'
import { ticketCategoryLabel } from '@/lib/support-i18n'
import { useCmsLang, useT } from '@/components/cms/CmsLang'
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
const HINTS_EN: Record<TicketCategory, string> = {
  content: 'e.g. Please move a story to another section; the home page layout will not save',
  design: 'e.g. Please change our logo or add a banner slot (attach a mockup or images)',
  dev: 'e.g. I would like a feature that does this',
  error: 'e.g. Saving fails on the ○○ screen (tell us which screen and what you pressed, and attach a screenshot)',
  billing: 'e.g. Change plan, reissue an invoice, change the contract holder',
  etc: 'Anything else you would like to ask',
}

// recipient: 운영팀이 회원 한 사람에게 먼저 보내는 안내 (작업 유형 없이 제목·내용·사진만)
export default function TicketForm({ requesterName, recipient }: { requesterName: string; recipient?: { id: string; name: string; note?: string } }) {
  const router = useRouter()
  const t = useT()
  const lang = useCmsLang()
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
    const res = recipient ? await sendStaffMessage(recipient.id, title, body) : await createTicket({ category, title, body })
    if (res.error || !res.id) { setError(res.error ?? t('저장하지 못했습니다.', 'Could not save.')); setBusy(false); return }
    const failed = files.length ? await uploadSupportFiles(res.id, null, files) : []
    if (failed.length) window.alert(t(`요청은 접수됐지만 올리지 못한 파일이 있습니다: ${failed.join(', ')}`, `Your request was received, but some files could not be uploaded: ${failed.join(', ')}`))
    router.push(`/support/tickets/${res.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-2xl bg-white p-5 ring-1 sm:p-8 ring-black/5">
      <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-center sm:gap-4">
        <span className="text-[14px] font-bold">{recipient ? t('받는 사람', 'Recipient') : t('요청인', 'Requested by')}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full bg-ink px-4 py-1.5 text-[13.5px] font-semibold text-white">{recipient ? recipient.name : requesterName}</span>
          {recipient && <span className="text-[12.5px] text-muted">{recipient.note ? `${recipient.note} · ` : ''}{t('이 분과 운영팀만 볼 수 있습니다. 받은 분에게 알림 메일이 갑니다.', 'Only this person and the team can see it. The recipient will be notified by email.')}</span>}
        </span>
      </div>
      {!recipient && <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-start sm:gap-4 border-t border-line pt-6">
        <span className="pt-1.5 text-[14px] font-bold">{t('작업 유형', 'Request type')}</span>
        <div>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('작업 유형', 'Request type')}>
            {(Object.keys(TICKET_CATEGORIES) as TicketCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-1.5 text-[14px] font-semibold ${category === c ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
              >
                {ticketCategoryLabel(c, lang)}
              </button>
            ))}
          </div>
          {category && <p className="mt-2 text-[12.5px] text-muted">{lang === 'en' ? HINTS_EN[category] : HINTS[category]}</p>}
        </div>
      </div>}
      <div className="space-y-3 border-t border-line pt-6">
        <label htmlFor="t-title" className="sr-only">{t('제목', 'Title')}</label>
        <input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t('제목을 입력해주세요', 'Enter a title')} className="field-input py-3 text-[15px]" />
        <label htmlFor="t-body" className="sr-only">{t('요청 내용', 'Request details')}</label>
        <textarea id="t-body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} placeholder={recipient ? t('예) 대표님, 체험은 어떠세요? 써 보시면 좋은 기능을 사진과 함께 안내드립니다. 좋았던 점·아쉬운 점을 답글로 남겨 주시면 바로 반영하겠습니다.', 'e.g. How is the trial going? Here are some features worth trying, with photos. Reply with what you liked and what could be better, and we will act on it right away.') : t('요청 내용을 자세히 적어주세요. 어느 화면인지, 원하는 결과가 무엇인지 적어주시면 더 빨리 처리됩니다.', 'Describe your request in detail. Tell us which screen it is and what result you want, and we can handle it faster.')} className="field-input resize-y text-[14.5px] leading-relaxed" />
      </div>
      <div className="grid gap-2 sm:grid-cols-[88px_1fr] sm:items-start sm:gap-4">
        <span className="pt-1.5 text-[14px] font-bold">{recipient ? t('사진 첨부', 'Attach photos') : t('파일 첨부', 'Attach files')}</span>
        <FilePicker files={files} setFiles={setFiles} />
      </div>
      {error && <p role="alert" className="text-[14px] font-semibold text-danger">{error}</p>}
      <div className="flex justify-center pt-2">
        <button type="submit" disabled={busy} className="rounded-full bg-[#2F6BF0] px-16 py-3.5 text-[16px] font-bold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? (files.length ? t('파일 올리는 중…', 'Uploading files…') : t('보내는 중…', 'Sending…')) : recipient ? t('안내 보내기', 'Send message') : t('작성완료', 'Submit')}
        </button>
      </div>
    </form>
  )
}
