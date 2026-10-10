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
    // 회원 정보는 매체와 두 갈래로 이어져 있어(소속·가입 때 신청한 매체) 묶어 읽지 않고 따로 읽는다
    const { data: p } = await supabase.from('profiles').select('*').eq('id', to).maybeSingle()
    if (p) {
      const { data: o } = p.outlet_id ? await supabase.from('outlets').select('name').eq('id', p.outlet_id).maybeSingle() : { data: null }
      recipient = { id: p.id as string, name: (p.full_name as string | null) ?? '회원', note: p.trial_until ? '무료 체험 중' : ((o as { name?: string } | null)?.name ?? undefined) }
    }
  }
  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="mb-6 text-[22px] font-extrabold tracking-tight">{recipient ? '운영팀 안내 보내기' : '업무요청 쓰기'}</h1>
      {isStaff && !recipient && (
        <p className="mb-5 rounded-xl border border-[#2F6BF0]/30 bg-[#2F6BF0]/5 px-5 py-4 text-[13.5px] leading-relaxed text-[#1F3A5F]">
          운영팀 계정입니다. 여기서 쓰면 <strong>내 업무요청</strong>으로 저장됩니다.<br />
          회원 한 분에게 안내를 보내려면 <a href="/admin/leads?tab=trial" className="font-semibold text-[#2F6BF0] underline">고객상담 → 무료 체험</a> 또는 <a href="/admin/users" className="font-semibold text-[#2F6BF0] underline">회원 관리 → 관리 ⋯</a>에서 <strong>[고객센터로 안내 보내기]</strong>를 누르세요.
        </p>
      )}
      <TicketForm requesterName={profile?.full_name ?? ''} recipient={recipient} />
    </div>
  )
}
