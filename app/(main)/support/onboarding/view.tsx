import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { FRESH_KEY, ONBOARDING_STEPS, stepStates, stepView, type StepState } from '@/lib/onboarding-guide'
import { LAUNCH_GROUPS, type LaunchDone, type LaunchItem } from '@/lib/launch-checklist'
import { ISSUER, previewUrl } from '@/lib/product'
import LaunchComments, { type LaunchComment } from '@/components/cms/LaunchComments'
import StepChecklist from '@/components/cms/StepChecklist'
import OnboardingSeen from '@/components/cms/OnboardingSeen'

// 개통 진행 현황: 고객은 자기 매체의 단계·코멘트를 보고, 운영팀(담당 매니저)은 같은 화면에서 항목을 체크하고 답한다
//   단계 진행도는 운영팀 체크 항목(lib/launch-checklist.ts)에서 정해진다 (launch-progress.sql, launch-hub.sql)
const BADGE: Record<StepState, { label: string; className: string }> = {
  done: { label: '완료', className: 'bg-[#E6F6EC] text-[#0F7A3A]' },
  doing: { label: '진행 중', className: 'bg-[#E8F0FE] text-[#1F55C9]' },
  todo: { label: '예정', className: 'bg-[#F1F2F4] text-muted' },
}

// 진행에는 영향이 없는 운영팀 표시·선택 작업: 해당 단계 안에 같이 보여 준다
const STAFF_EXTRA: Record<string, string[]> = { import: [FRESH_KEY], launch: ['kakao_domain'] }
const ITEM_OF = new Map<string, LaunchItem>(LAUNCH_GROUPS.flatMap((g) => g.items).map((i) => [i.key, i]))

export default async function OnboardingView({ outletId, staff }: { outletId: string; staff: boolean }) {
  const { supabase } = await getCmsContext()
  const [{ data: outlet }, progressRes, doneRes, commentRes] = await Promise.all([
    supabase.from('outlets').select('name, domain, site').eq('id', outletId).maybeSingle(),
    staff ? Promise.resolve({ data: null, error: null }) : supabase.rpc('launch_progress', { o: outletId }),
    staff ? supabase.from('launch_checklists').select('done').eq('outlet_id', outletId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from('launch_comments').select('id, step_id, author_name, from_staff, body, created_at').eq('outlet_id', outletId).order('created_at'),
  ])
  const ready = staff ? !doneRes.error : !progressRes.error
  const doneMap: LaunchDone = staff
    ? ((doneRes.data as { done?: LaunchDone } | null)?.done ?? {})
    : Object.fromEntries((Array.isArray(progressRes.data) ? (progressRes.data as string[]) : []).map((k) => [k, '']))
  const states = stepStates(doneMap, true)
  const fresh = FRESH_KEY in doneMap
  const finished = states.filter((s) => s === 'done').length
  const pct = Math.round((finished / states.length) * 100)
  const comingSoon = (outlet?.site as { comingSoon?: boolean } | null)?.comingSoon === true
  const commentsReady = !commentRes.error
  const comments = (commentRes.data ?? []) as LaunchComment[]
  const of = (stepId: string | null) => comments.filter((c) => c.step_id === stepId)

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8 md:py-10">
      <OnboardingSeen outletId={outletId} staff={staff} />
      {staff && <Link href="/admin/onboarding" className="text-[13px] text-muted underline underline-offset-2">← 개통 현황 목록</Link>}
      <h1 className="mt-1 text-[22px] font-extrabold tracking-tight">개통 진행 현황{staff && outlet?.name ? ` · ${outlet.name}` : ''}</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        {staff
          ? '고객이 보는 화면과 같습니다. 단계마다 운영팀 체크 항목을 체크하면 고객 화면의 진행도가 바뀌고, 고객이 남긴 코멘트에는 이 화면에서 답합니다.'
          : '신청부터 정식 오픈, 오픈 후 점검까지 단계별로 어디까지 왔는지 보여 드립니다. 일정은 영업일 기준 보통의 목표이며, 자료나 도메인 설정이 늦어지면 함께 늦어질 수 있습니다. 단계마다 궁금한 점이나 요청을 남겨 주시면 담당 매니저가 확인하고 답합니다.'}
      </p>

      {!ready && (
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-[14px] text-muted ring-1 ring-black/5">
          {staff ? '체크리스트를 쓰려면 Supabase에서 launch-checklist.sql과 launch-progress.sql을 실행해 주세요.' : `진행 현황을 아직 불러올 수 없습니다. 궁금한 점은 ${ISSUER.contact ?? '운영팀'}으로 문의해 주세요.`}
        </p>
      )}

      {ready && (
        <>
          <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[15px] font-bold">{finished === states.length ? '모든 단계가 끝났습니다' : `${states.length}단계 중 ${finished}단계 완료`}</p>
              <p className="text-[13px] tabular-nums text-muted">{pct}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEF0F3]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="개통 진행률">
              <div className="h-full rounded-full bg-[#2F6BF0] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {comingSoon && (
            <div className="mt-5 rounded-2xl bg-[#FFF6E5] p-5 text-[14px] leading-relaxed ring-1 ring-[#F5A524]/30">
              <p className="font-bold">지금은 오픈 준비 중입니다</p>
              <p className="mt-1 text-[#5B4A1F]">도메인으로 들어온 방문자에게는 “오픈 준비 중” 안내 화면이 보입니다. 정식 오픈 전에 실제 홈페이지가 어떻게 보이는지는 아래 링크에서 미리 확인하실 수 있습니다.</p>
              <a href={previewUrl(outletId)} target="_blank" rel="noopener" className="mt-3 inline-block rounded-full bg-[#2F6BF0] px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90">홈페이지 미리보기 ↗</a>
            </div>
          )}

          <ol className="mt-5 space-y-3">
            {ONBOARDING_STEPS.map((step, i) => {
              const s = stepView(step, fresh)
              const st = states[i]
              const b = BADGE[st]
              const items = [...step.keys, ...(STAFF_EXTRA[step.id] ?? [])].map((k) => ITEM_OF.get(k)).filter((x): x is LaunchItem => !!x)
              return (
                <li key={s.id} className={`rounded-2xl bg-white p-5 ring-1 ${st === 'doing' ? 'ring-[#2F6BF0]/50' : 'ring-black/5'} ${st === 'done' && !staff ? 'opacity-90' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold ${b.className}`}>{b.label}</span>
                    <h2 className="text-[16px] font-extrabold">{s.title}</h2>
                    <span className="ml-auto text-[12.5px] text-muted">보통 {s.days}</span>
                  </div>
                  {(st !== 'done' || staff) && (
                    <div className="mt-3 grid gap-4 text-[13.5px] leading-relaxed sm:grid-cols-2">
                      <div>
                        <p className="text-[12px] font-bold text-muted">저희가 합니다</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">{s.we.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-muted">대표님께 부탁드립니다</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">{s.you.map((x) => <li key={x}>{x}</li>)}</ul>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-[13px] text-[#3B4048]"><span className="font-bold">끝나면</span> {s.result}</p>
                  {staff && items.length > 0 && <StepChecklist outletId={outletId} items={items} done={doneMap} />}
                  {commentsReady && (
                    <LaunchComments outletId={outletId} stepId={step.id} initial={of(step.id)} staff={staff} title={staff ? '이 단계 코멘트' : '이 단계에 대한 질문·의견'} hint={staff ? undefined : '이 단계에서 어떻게 할지, 궁금한 점이 있으면 여기에 적어 주세요.'} />
                  )}
                </li>
              )
            })}
          </ol>

          {commentsReady ? (
            <section className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <h2 className="text-[16px] font-extrabold">궁금한 점·전달할 말씀</h2>
              <p className="mt-1 text-[13px] text-muted">특정 단계가 아니어도 괜찮습니다. 남겨 주시면 담당 매니저가 확인하고 이 아래에 답합니다.</p>
              <LaunchComments outletId={outletId} stepId={null} initial={of(null)} staff={staff} title="전체 문의" defaultOpen />
            </section>
          ) : (
            staff && <p className="mt-5 rounded-2xl bg-[#FFF6E5] px-5 py-4 text-[13.5px]">코멘트를 쓰려면 Supabase에서 <code>supabase/launch-hub.sql</code>을 실행해 주세요.</p>
          )}
        </>
      )}

      <p className="mt-8 text-[13px] text-muted">
        급한 일은 <Link href="/support/tickets/new" className="font-semibold text-ink underline">업무요청</Link>을 남기거나 {ISSUER.contact ?? '운영팀'}으로 알려 주세요.
      </p>
    </div>
  )
}
