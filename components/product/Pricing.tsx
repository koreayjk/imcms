'use client'

import { useState } from 'react'
import { appLink } from '@/lib/product'

import { ANNUAL_FREE, ANNUAL_MONTHS, BETA_END_LABEL, EXTRA_AI_FEE, EXTRA_OUTLET_FEE, PLANS, REGULAR_AFTER_LABEL, BETA_PERIOD_LABEL, SETUP_FEE, SETUP_ITEMS, betaDaysLeft, isBeta, planCharge, won, type PlanId } from '@/lib/pricing'

// 소개 페이지 요금표 (금액은 lib/pricing.ts)
//   요금제의 신청 버튼을 누르면 아래 신청서에 그 요금제·결제 방식이 골라진다 (im-pick-plan 이벤트)
export const PICK_PLAN_EVENT = 'im-pick-plan'
export type PickPlanDetail = { plan: PlanId; billing: 'monthly' | 'annual' }

const COMMON = [
  '기자 계정 무제한',
  'AI 기사 초안 · 원문 대조 점검',
  '발행 전 AI 법적 검수 (명예훼손·저작권·개인정보)',
  '홈페이지 모양 미리보기 · 미리보기 링크 공유',
  '자동 임시 저장 · 사진 워터마크',
  '보도자료 자동 수집 · 메일로 받기',
  '기자 → 편집장 승인 · 예약 발행',
  '기사 수정 이력 · 되돌리기',
  '휴대폰 편집국',
  'PC · 모바일 홈페이지',
  '쓰던 도메인 연결 · 무료 SSL',
  '사이트맵 · RSS · 포털 등록 준비',
  '매일 자동 백업',
  '편집국 안 고객센터',
  '뉴스레터 발송 · 알림 메일',
  '도메인 이메일 연결 설정 지원',
  '유튜브 동영상 기사',
  '광고 배너 관리 · 애드센스 설치',
]

export default function Pricing({ applyHref = '#apply' }: { applyHref?: string }) {
  const [annual, setAnnual] = useState(true)
  // 베타(출시 전 테스트): 10월 31일까지 가입하면 첫 3개월 반값, 4개월째부터 정상가
  const BETA = isBeta()
  const daysLeft = betaDaysLeft()
  const pick = (plan: PlanId) => window.dispatchEvent(new CustomEvent<PickPlanDetail>(PICK_PLAN_EVENT, { detail: { plan, billing: annual ? 'annual' : 'monthly' } }))

  return (
    <div>
      {BETA && (
        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-4 rounded-lg bg-[#EFF2F7] ring-1 ring-[#DADFE8] px-7 py-6 text-center text-[#0F1115] sm:flex-row sm:justify-between sm:text-left">
          <span>
            <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.06em] text-[#C2410C]"><span className="rounded bg-[#E8590C] px-1.5 py-0.5 text-[11px] tracking-normal text-white">D-{daysLeft}</span>출시 기념 베타</span>
            <span className="mt-1 block text-[21px] font-extrabold tracking-[-0.02em] sm:text-[24px]">1주일 무료 체험 → {BETA_END_LABEL}까지 가입하면 <span className="text-[#C2410C]">{BETA_PERIOD_LABEL} 반값</span></span>
            <span className="mt-1 block text-[13px] text-[#5B616B]">{REGULAR_AFTER_LABEL} 정상가로 바뀝니다</span>
          </span>
          <span className="flex shrink-0 flex-wrap justify-center gap-2">
            <a href={appLink('/trial')} className="rounded-md bg-[#1D3461] px-5 py-3 text-[15px] font-bold text-white transition hover:bg-[#152748]">1주일 무료 체험 →</a>
            <a href={applyHref} className="rounded-md border border-[#DADFE8] bg-white px-5 py-3 text-[15px] font-semibold text-[#16294D] transition hover:bg-[#EFF2F7]">바로 신청</a>
          </span>
        </div>
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
            <span className="rounded-full bg-[#EFF2F7] px-2 py-0.5 text-[12px] font-bold text-[#16294D]">{ANNUAL_FREE}</span>
          </button>
        </div>
        <p className="text-[14px] text-[#5B616B]">
          {annual ? <>1년 요금을 한 번에 내시면 <strong className="text-[#16294D]">12개월을 {ANNUAL_MONTHS}개월 값</strong>으로 씁니다.</> : '매달 결제하고 언제든 해지할 수 있습니다.'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const charge = planCharge(p, annual ? 'annual' : 'monthly', BETA)
          const regular = charge?.regular ?? null
          const price = charge?.price ?? null
          // 1년 결제로 아끼는 금액 = 달마다 낼 때(베타 반영)보다 덜 내는 1개월치
          const saved = price == null || !annual ? 0 : Math.round(price / ANNUAL_MONTHS)
          const yearly = p.monthly == null ? null : planCharge(p, 'annual', BETA)?.price ?? null
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-lg bg-white p-6 ${p.pick ? 'ring-2 ring-[#1D3461] shadow-[0_24px_50px_-28px_rgba(15,17,21,0.45)]' : 'ring-1 ring-black/5 shadow-[0_10px_30px_-18px_rgba(11,16,32,0.3)]'}`}
            >
              {p.pick && <span className="absolute -top-3 left-6 rounded-full bg-[#1D3461] px-3 py-1 text-[12px] font-bold text-white">추천</span>}
              <p className="text-[19px] font-extrabold tracking-[-0.02em]">{p.name}</p>
              <p className="mt-1 min-h-[42px] text-[13.5px] leading-snug text-[#5B616B]">{p.for}</p>

              <div className="mt-5 min-h-[104px]">
                {price == null ? (
                  <p className="pt-3 text-[28px] font-extrabold tracking-[-0.02em] text-[#9AA0A8]">별도 문의</p>
                ) : (
                  <>
                    {BETA && <p className="text-[14px] tabular-nums text-[#9AA0A8]"><s>{won(regular!)}</s> <span className="ml-1 rounded bg-[#FFF3EB] px-1.5 py-0.5 text-[12px] font-bold text-[#C2410C]">{annual ? `${BETA_PERIOD_LABEL}분 반값` : `${BETA_PERIOD_LABEL} 반값`}</span></p>}
                    <p className="mt-1 tabular-nums">
                      <span className="text-[32px] font-extrabold tracking-[-0.03em]">{won(price)}</span>
                      <span className="ml-1 text-[14px] font-semibold text-[#5B616B]">/{annual ? '년' : '월'}</span>
                      <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-[#F4F5F7] px-1.5 py-0.5 align-[3px] text-[11.5px] font-semibold text-[#5B616B]">VAT 포함</span>
                    </p>
                    {annual
                      ? <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#16294D]">한 달 약 {(price / 12 / 10_000).toFixed(1)}만 원꼴 · {won(saved)} 절약</p>
                      : <p className="mt-1 text-[13px] tabular-nums text-[#5B616B]">{BETA ? `${REGULAR_AFTER_LABEL} 월 ${won(p.monthly!)}` : `1년 결제 시 ${won(yearly!)}/년`}</p>}
                  </>
                )}
              </div>

              <a
                href={applyHref}
                onClick={() => pick(p.id)}
                className={`mt-5 rounded-md px-4 py-3 text-center text-[15px] font-bold transition ${p.pick ? 'bg-[#1D3461] text-white hover:bg-[#152748]' : 'bg-white text-[#16294D] ring-1 ring-[#DADFE8] hover:bg-[#EFF2F7]'}`}
              >
                {price == null ? '상담 신청' : '신청하기'}
              </a>
              {price != null && <a href={appLink('/trial')} className="mt-2 text-center text-[13.5px] font-semibold text-[#5B616B] underline-offset-4 hover:text-[#14171C] hover:underline">먼저 1주일 무료 체험 →</a>}

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
                  {p.extras.map((x) => <li key={x} className="flex gap-2"><span className="text-[#16294D]" aria-hidden>✓</span>{x}</li>)}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-lg bg-white p-6 ring-1 ring-black/5 sm:p-8">
        <p className="text-[16px] font-extrabold">모든 요금제에 기본으로 들어 있습니다</p>
        <ul className="mt-4 grid gap-x-6 gap-y-2.5 text-[14.5px] text-[#3B4048] sm:grid-cols-2 lg:grid-cols-3">
          {COMMON.map((c) => <li key={c} className="flex gap-2"><span className="font-bold text-[#16294D]" aria-hidden>✓</span>{c}</li>)}
        </ul>
      </div>

      {/* ─── 세팅비 ─── */}
      <section aria-labelledby="setup-title" className="mt-4 rounded-lg bg-white p-6 ring-1 ring-black/5 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="setup-title" className="text-[16px] font-extrabold">세팅비 · 처음 개통할 때 한 번</h3>
            <p className="mt-1 text-[13.5px] text-[#5B616B]">신문사 편집국과 홈페이지를 바로 쓸 수 있게 저희가 처음부터 설정해 드리는 비용입니다. 매달 내는 이용료와 별도로 한 번만 냅니다.</p>
          </div>
          <p className="tabular-nums">
            {BETA && <span className="mr-2 text-[15px] text-[#9AA0A8]"><s>{won(SETUP_FEE)}</s></span>}
            <span className="text-[26px] font-extrabold tracking-[-0.02em]">{BETA ? '0원' : won(SETUP_FEE)}</span>
            <span className="ml-1.5 inline-block whitespace-nowrap rounded bg-[#F4F5F7] px-1.5 py-0.5 align-[4px] text-[11.5px] font-semibold text-[#5B616B]">VAT 포함</span>
            {BETA && <span className="ml-2 inline-block whitespace-nowrap rounded bg-[#FFF3EB] px-2 py-0.5 align-[4px] text-[12px] font-bold text-[#C2410C]">베타 기간 신청 무료</span>}
          </p>
        </div>
        <ul className="mt-5 grid gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
          {SETUP_ITEMS.map(([t, d]) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-0.5 font-bold text-[#16294D]" aria-hidden>✓</span>
              <span><strong className="font-bold text-[#14171C]">{t}</strong><span className="block text-[13px] leading-snug text-[#5B616B]">{d}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-[#8A9099]">{BETA ? `베타 기간이 끝난 뒤 신청하시면 세팅비 ${won(SETUP_FEE)}이 첫 결제에 함께 청구됩니다. ` : ''}개통한 뒤에는 세팅비를 돌려드리지 않습니다.</p>
      </section>

      <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-2">
        {[
          ['매체 추가', `${won(EXTRA_OUTLET_FEE)}/월`, '프리미엄 전용 · 매체 2개까지 포함, 3번째 매체부터 매체마다 (추가 매체는 베이직 사양)'],
          ['AI 사용 추가', won(EXTRA_AI_FEE), '월 한도(초안·법적 검수)를 넘으면 100회마다'],
        ].map(([k, v, d]) => (
          <div key={k} className="rounded-lg bg-white p-5 ring-1 ring-black/5">
            <dt className="text-[13px] font-semibold text-[#5B616B]">{k}</dt>
            <dd className="mt-1 text-[20px] font-extrabold tabular-nums">{v}</dd>
            <dd className="mt-1 text-[13px] leading-snug text-[#5B616B]">{d}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-center text-[12.5px] leading-relaxed text-[#8A9099]">
        모든 금액은 부가세(VAT) 포함입니다. * 전송량은 일반적인 언론사 사용 기준으로 제한 없이 쓰며, 아주 큰 트래픽이 계속되면 요금제를 함께 정합니다. 배너·팝업 디자인은 운영팀이 만들어 드리는 건수이고, 직접 만든 배너는 개수 제한 없이 올릴 수 있습니다. 자세한 조건은 <a href="/imnewsroom/terms" className="underline hover:text-[#14171C]">이용약관</a>을 확인해 주세요.
        {BETA && ` 베타 반값은 ${BETA_END_LABEL}까지 신청한 신문사의 ${BETA_PERIOD_LABEL} 이용료에 적용되고, ${REGULAR_AFTER_LABEL} 정상가입니다. 1년 결제는 12개월 중 ${BETA_PERIOD_LABEL}분만 반값으로 계산합니다. 매체 추가·AI 추가 사용 요금은 베타 기간에도 정상가입니다.`}
      </p>
    </div>
  )
}
