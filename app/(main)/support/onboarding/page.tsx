import type { Metadata } from 'next'
import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { FRESH_KEY, ONBOARDING_STEPS, stepStates, stepView, type StepState } from '@/lib/onboarding-guide'
import { ISSUER, previewUrl } from '@/lib/product'

export const metadata: Metadata = { title: '개통 진행 현황' }

// 고객센터 → 개통 진행 현황: 운영팀 개통 체크리스트(고객에게는 보이지 않음)에서 끝낸 항목만 단계로 묶어 보여 준다 (launch-progress.sql)
const BADGE: Record<StepState, { label: string; className: string }> = {
  done: { label: '완료', className: 'bg-[#E6F6EC] text-[#0F7A3A]' },
  doing: { label: '진행 중', className: 'bg-[#E8F0FE] text-[#1F55C9]' },
  todo: { label: '예정', className: 'bg-[#F1F2F4] text-muted' },
}

export default async function OnboardingProgressPage() {
  const { supabase, outletId } = await getCmsContext()
  const { data, error } = outletId ? await supabase.rpc('launch_progress', { o: outletId }) : { data: null, error: null }
  const ready = !error
  const { data: outlet } = outletId ? await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle() : { data: null }
  const comingSoon = (outlet?.site as { comingSoon?: boolean } | null)?.comingSoon === true
  const doneKeys: string[] = Array.isArray(data) ? data : []
  const states = stepStates(Object.fromEntries(doneKeys.map((k) => [k, true])), !!outletId)
  const fresh = doneKeys.includes(FRESH_KEY)
  const finished = states.filter((s) => s === 'done').length
  const pct = Math.round((finished / states.length) * 100)

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">개통 진행 현황</h1>
      <p className="mt-1 text-[13.5px] text-muted">신청부터 정식 오픈, 오픈 후 점검까지 단계별로 어디까지 왔는지 보여 드립니다. 일정은 영업일 기준 보통의 목표이며, 자료나 도메인 설정이 늦어지면 함께 늦어질 수 있습니다.</p>

      {!outletId && (
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-[14px] text-muted ring-1 ring-black/5">매체를 먼저 선택해 주세요.</p>
      )}

      {outletId && !ready && (
        <p className="mt-6 rounded-2xl bg-white px-6 py-10 text-center text-[14px] text-muted ring-1 ring-black/5">진행 현황을 아직 불러올 수 없습니다. 궁금한 점은 {ISSUER.contact ?? '운영팀'}으로 문의해 주세요.</p>
      )}

      {outletId && ready && (
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

          {comingSoon && outletId && (
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
              return (
                <li key={s.id} className={`rounded-2xl bg-white p-5 ring-1 ${st === 'doing' ? 'ring-[#2F6BF0]/50' : 'ring-black/5'} ${st === 'done' ? 'opacity-80' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-bold ${b.className}`}>{b.label}</span>
                    <h2 className="text-[16px] font-extrabold">{s.title}</h2>
                    <span className="ml-auto text-[12.5px] text-muted">보통 {s.days}</span>
                  </div>
                  {st !== 'done' && (
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
                </li>
              )
            })}
          </ol>
        </>
      )}

      <p className="mt-8 text-[13px] text-muted">
        막히는 부분이 있으면 <Link href="/support/tickets/new" className="font-semibold text-ink underline">업무요청</Link>을 남기거나 {ISSUER.contact ?? '운영팀'}으로 알려 주세요.
      </p>
    </div>
  )
}
