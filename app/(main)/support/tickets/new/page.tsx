import { getCmsContext } from '@/lib/cms'
import TicketForm from '@/components/cms/TicketForm'

// 요청을 저장한 뒤 AI 첫 답변을 이어서 만든다 (support/actions.ts createTicket)
export const maxDuration = 60

export default async function NewTicketPage() {
  const { profile } = await getCmsContext()
  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">업무요청 쓰기</h1>
      <TicketForm requesterName={profile?.full_name ?? ''} />
    </div>
  )
}
