'use client'

import { useState } from 'react'

import { ANNUAL_MONTHS, BETA, BETA_RATE, EXTRA_AI_FEE, EXTRA_OUTLET_FEE, PLANS, SETUP_FEE, won, type PlanId } from '@/lib/pricing'

// 소개 페이지 요금표 (금액은 lib/pricing.ts)
//   요금제의 신청 버튼을 누르면 아래 신청서에 그 요금제·결제 방식이 골라진다 (im-pick-plan 이벤트)
export const PICK_PLAN_EVENT = 'im-pick-plan'
export type PickPlanDetail = { plan: PlanId; billing: 'monthly' | 'annual' }

const COMMON = [
  '기자 계정 무제한',
  'AI 기사 초안 · 원문 대조 점검',
  '보도자료 자동 수집 · 메일로 받기',
  '기자 → 편집장 승인 · 예약 발행',
  '자동 저장 · 기사 수정 이력',
  '휴대폰 편집국',
  'PC · 모바일 홈페이지',
  '쓰던 도메인 연결 · 무료 SSL',
  '사이트맵 · RSS · 포털 등록 준비',
  '매일 자동 백업',
  '편집국 안 고객센터',
]

export default function Pricing({ applyHref = '#apply' }: { applyHref?: string }) {
  const [annual, setAnnual] = useState(true)
  const rate = BETA ? BETA_RATE : 1
  const pick = (plan: PlanId) => window.dispatchEvent(new CustomEvent<PickPlanDetail>(PICK_PLAN_EVENT, { detail: { plan, billing: annual ? 'annual' : 'monthly' } }))

  return (
    <div>
      {BETA && (
        <a
          href={applyHref}
          className="group mx-auto flex max-w-[860px] flex-col items-center gap-3 rounded-2xl bg-gradient-to-r from-[#F5A524] via-[#EF6B3A] to-[#D93B4A] px-6 py-5 text-center text-white shadow-[0_20px_50px_-20px_rgba(217,59,74,0.8)] transition hover:-translate-y-0.5 sm:flex-row sm:justify-between sm:text-left"
        >
          <span>
            <span className="block text-[13px] font-bold tracking-[0.06em] text-white/85">베타 테스트 신문사 모집 중</span>
            <span className="mt-0.5 block text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">지금 참여하시면 모든 요금 <span className="underline decoration-white/60 decoration-[3px] underline-offset-[6px]">반값</span></span>
          </span>
          <span className="shrink-0 rounded-xl bg-white px-5 py-3 text-[15px] font-bold text-[#D93B4A] transition group-hover:brightness-95">베타 신청하기 →</span>
        </a>
      )}

      <div className="mt-10 flex flex-col items-center gap-3">
        <div role="group" aria-label="결제 방식" className="inline-flex rounded-full bg-[#F4F5F7] p-1 ring-1 ring-black/5">
          <button
            type="button"
            aria-pressed={!annual}
            onClick={() => setAnnual(false)}
            className={`rounded-full px-5 py-2.5 text-[15px] font-bold transition ${!annual ? 'bg-white text-[#14171C] shadow-[0_4px_14px_-6px_rgba(11,16,32,0.4)]' : 'text-[#5B616B] hover:text-[#14171C]'}`}
          >
            월 결제
          </button>
          <button
            type="button"
            aria-pressed={annual}
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-[15px] font-bold transition ${annual ? 'bg-white text-[#14171C] shadow-[0_4px_14px_-6px_rgba(11,16,32,0.4)]' : 'text-[#5B616B] hover:text-[#14171C]'}`}
          >
            1년 한 번에 결제
            <span className="rounded-full bg-[#10B981] px-2 py-0.5 text-[12px] font-extrabold text-white">2개월 무료</span>
          </button>
        </div>
        <p className="text-[14px] text-[#5B616B]">
          {annual ? <>1년 요금을 한 번에 내시면 <strong className="text-[#0F9F6E]">12개월을 10개월 값</strong>으로 씁니다.</> : '매달 결제하고 언제든 해지할 수 있습니다.'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const months = annual ? ANNUAL_MONTHS : 1
          const regular = p.monthly == null ? null : p.monthly * months
          const price = regular == null ? null : regular * rate
          const saved = p.monthly == null || !annual ? 0 : p.monthly * (12 - ANNUAL_MONTHS) * rate
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl bg-white p-6 ${p.pick ? 'ring-2 ring-[#EF6B3A] shadow-[0_24px_50px_-24px_rgba(217,59,74,0.55)]' : 'ring-1 ring-black/5 shadow-[0_10px_30px_-18px_rgba(11,16,32,0.3)]'}`}
            >
              {p.pick && <span className="absolute -top-3 left-6 rounded-full bg-[#EF6B3A] px-3 py-1 text-[12px] font-bold text-white">추천</span>}
              <p className="text-[19px] font-extrabold tracking-[-0.02em]">{p.name}</p>
              <p className="mt-1 min-h-[42px] text-[13.5px] leading-snug text-[#5B616B]">{p.for}</p>

              <div className="mt-5 min-h-[104px]">
                {price == null ? (
                  <p className="pt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#9AA0A8]">별도 문의</p>
                ) : (
                  <>
                    {BETA && <p className="text-[14px] tabular-nums text-[#9AA0A8]"><s>{won(regular!)}</s> <span className="ml-1 rounded bg-[#FDECEA] px-1.5 py-0.5 text-[12px] font-bold text-[#D93B4A]">베타 반값</span></p>}
                    <p className="mt-1 tabular-nums">
                      <span className="text-[32px] font-extrabold tracking-[-0.03em]">{won(price)}</span>
                      <span className="ml-1 text-[14px] font-semibold text-[#5B616B]">/{annual ? '년' : '월'}</span>
                    </p>
                    {annual
                      ? <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#0F9F6E]">한 달 약 {(price / 12 / 10_000).toFixed(1)}만 원꼴 · {won(saved)} 절약</p>
                      : <p className="mt-1 text-[13px] tabular-nums text-[#5B616B]">1년 결제 시 {won(p.monthly! * ANNUAL_MONTHS * rate)}/년</p>}
                  </>
                )}
              </div>

              <a
                href={applyHref}
                onClick={() => pick(p.id)}
                className={`mt-5 rounded-xl px-4 py-3 text-center text-[15px] font-bold transition ${p.pick ? 'bg-gradient-to-r from-[#F5A524] to-[#E5483A] text-white hover:brightness-110' : 'bg-[#14171C] text-white hover:bg-[#2A2F37]'}`}
              >
                {price == null ? '상담 신청' : BETA ? '베타 신청하기' : '신청하기'}
              </a>

              <dl className="mt-6 space-y-2 border-t border-[#EEF0F3] pt-5 text-[14px]">
                {p.specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#5B616B]">{k}</dt>
                    <dd className="font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.extras.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-[13.5px] text-[#3B4048]">
                  {p.extras.map((x) => <li key={x} className="flex gap-2"><span className="text-[#10B981]" aria-hidden>✓</span>{x}</li>)}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-8">
        <p className="text-[16px] font-extrabold">모든 요금제에 기본으로 들어 있습니다</p>
        <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-[14.5px] text-[#3B4048] sm:grid-cols-2 lg:grid-cols-3">
          {COMMON.map((c) => <li key={c} className="flex gap-2"><span className="font-bold text-[#10B981]" aria-hidden>✓</span>{c}</li>)}
        </ul>
      </div>

      <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-3">
        {[
          ['세팅비', won(SETUP_FEE), `다른 프로그램에서 옮겨 오${BETA ? '거나 베타 신문사는' : '면'} 무료 (기사·사진 이전 포함)`],
          ['매체 추가', `${won(EXTRA_OUTLET_FEE)}/월`, '같은 그룹에 매체를 더 둘 때 매체마다'],
          ['AI 초안 추가', won(EXTRA_AI_FEE), '월 한도를 넘으면 100건마다'],
        ].map(([k, v, d]) => (
          <div key={k} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <dt className="text-[13px] font-semibold text-[#5B616B]">{k}</dt>
            <dd className="mt-1 text-[20px] font-extrabold tabular-nums">{v}</dd>
            <dd className="mt-1 text-[13px] leading-snug text-[#5B616B]">{d}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-[#8A9099]">
        모든 금액은 VAT 포함입니다. 업무요청 포인트는 배너·팝업 교체 같은 디자인·설정 작업에 씁니다. 자세한 조건은 <a href="/imnewsroom/terms" className="underline hover:text-[#14171C]">이용약관</a>을 확인해 주세요.
        {BETA && ' 베타 반값의 적용 기간과 조건은 상담할 때 안내해 드립니다.'}
      </p>
    </div>
  )
}
