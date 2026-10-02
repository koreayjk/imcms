import { getCmsContext } from '@/lib/cms'
import { outletEmailOf } from '@/lib/outlet-email'
import { getAiStatus } from '@/lib/ai-usage'
import ContactEmailForm from '@/components/cms/ContactEmailForm'
import MemberAiRow, { type MemberAi } from '@/components/cms/MemberAiRow'

// 편집국 설정: 언론사 대표 이메일(편집장 이상) · 기자별 AI 사용량(편집장 이상은 모두, 기자는 자기 것)
export default async function NewsroomSettingsPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const manager = isEditorPlus || isStaff
  if (!outletId) {
    return <div className="mx-auto max-w-[960px] px-4 py-10 md:px-8"><p className="rounded-lg border border-line bg-white px-5 py-4 text-sm">위쪽에서 작업할 매체를 먼저 골라 주세요.</p></div>
  }
  const [contact, status, { data: members, error }] = await Promise.all([
    outletEmailOf(supabase, outletId),
    getAiStatus(supabase, outletId),
    supabase.rpc('ai_member_usage', { o: outletId }),
  ])
  const month = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="mx-auto max-w-[960px] space-y-6 px-4 py-5 md:px-8 md:py-8">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">{manager ? '편집국 설정' : '내 AI 사용량'}</h1>
      </header>

      {!contact.ready ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">이 화면을 쓰려면 운영팀이 Supabase에서 <code>supabase/newsroom-settings.sql</code>을 실행해야 합니다.</p>
      ) : (
        <>
          {manager && (
            <section aria-labelledby="mail-title" className="rounded-xl border border-line bg-white p-5">
              <h2 id="mail-title" className="text-[16px] font-bold">언론사 대표 이메일</h2>
              <p className="mb-3 mt-1 text-[13px] text-muted">기자들이 쓴 기사의 기자명 옆에 이 이메일이 붙습니다(기자는 바꿀 수 없음). 편집장 이상은 기사쓰기 화면에서 기사마다 다른 이메일로 바꿀 수 있습니다.</p>
              <ContactEmailForm email={contact.email} />
            </section>
          )}

          <section aria-labelledby="ai-title" className="rounded-xl border border-line bg-white">
            <div className="border-b border-line px-5 py-4">
              <h2 id="ai-title" className="text-[16px] font-bold">{month} 기자별 AI 사용량</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                {status?.limit != null
                  ? <>매체 전체 AI 초안 <strong className="text-ink">{status.used} / {status.limit}건</strong>. </>
                  : '요금제 한도가 없는 매체입니다. '}
                {manager
                  ? '기자별 한도를 비워 두면 매체 한도를 인원수로 나눠 자동으로 정해집니다(예: 월 100건 · 2명 → 각 50건). 숫자를 적으면 그 사람만 따로 정해지고, 나머지 인원이 남은 건수를 나눠 갖습니다. 법적 검수는 한도에 세지 않습니다.'
                  : '편집장이 정한 내 한도입니다. 더 필요하면 편집장에게 요청해 주세요. 법적 검수는 한도에 세지 않습니다.'}
              </p>
            </div>
            {error ? (
              <p className="px-5 py-5 text-[13px] text-muted">사용량을 읽지 못했습니다.</p>
            ) : (
              <ul className="divide-y divide-line">
                {((members ?? []) as MemberAi[]).map((m) => <MemberAiRow key={m.profile_id} m={m} editable={manager} />)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
