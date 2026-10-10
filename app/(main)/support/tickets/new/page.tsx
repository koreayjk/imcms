import { getCmsContext } from '@/lib/cms'
import TicketForm from '@/components/cms/TicketForm'

// 요청을 저장한 뒤 AI 첫 답변을 이어서 만든다 (support/actions.ts createTicket)
export const maxDuration = 60

export default async function NewTicketPage(props: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await props.searchParams
  const { supabase, profile, isStaff } = await getCmsContext()
  // 운영팀: ?to=회원 → 그 사람에게만 보이는 안내 보내기 (체험 신청자 등)
  let recipient: { id: string; name: string; note?: string } | undefined
  if (isStaff && to && /^[0-9a-f-]{36}$/.test(to)) {
    const { data: p } = await supabase.from('profiles').select('id, full_name, trial_until, outlet:outlets(name)').eq('id', to).maybeSingle()
    if (p) recipient = { id: p.id, name: p.full_name ?? '회원', note: (p as { trial_until?: string | null }).trial_until ? '무료 체험 중' : ((p as unknown as { outlet?: { name: string } | null }).outlet?.name ?? undefined) }
  }
  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">{recipient ? '운영팀 안내 보내기' : '업무요청 쓰기'}</h1>
      <TicketForm requesterName={profile?.full_name ?? ''} recipient={recipient} />
    </div>
  )
}
