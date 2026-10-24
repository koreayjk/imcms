'use client'

import { useEffect, useState, useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { submitBetaRequest, type ApplyState } from '@/app/imnewsroom/actions'
import { ANNUAL_FREE, ANNUAL_MONTHS, BILLING_LABEL, PLANS, BETA_PERIOD_LABEL, REGULAR_AFTER_LABEL, SETUP_FEE, SETUP_WAIVER_MONTHS, firstPayment, isBeta, planById, won, type Billing, type PlanId } from '@/lib/pricing'
import { applyConsentSections, termsSections } from '@/lib/service-terms'
import { PRODUCT } from '@/lib/product'
import { PICK_PLAN_EVENT, type PickPlanDetail } from './Pricing'
import PolicyDoc from './PolicyDoc'
import { HOME_LAYOUTS } from '@/lib/home-layouts'

const input =
  'w-full rounded-md border border-[#D5D8DD] bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors placeholder:text-[#A3A8B0] focus:border-[#1D3461]'

function Field({ id, label, required, children, hint }: { id: string; label: string; required?: boolean; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-[#14171C]">
        {label} {required && <span className="text-[#D6402B]">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] leading-snug text-[#5B616B]">{hint}</p>}
    </div>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-[#1D3461] px-5 py-4 text-[16px] font-bold text-white transition hover:bg-[#152748] disabled:opacity-60"
    >
      {pending ? '보내는 중…' : '서비스 신청하기'}
    </button>
  )
}

function Consent({ name, title, checked, onChange, children, link }: { name: string; title: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; link?: { href: string; label: string } }) {
  return (
    <div className="rounded-md border border-[#E4E6EA]">
      <label className="flex cursor-pointer items-center gap-2.5 px-4 py-3 text-[14px] font-semibold">
        <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[#D6402B]" />
        <span className="flex-1">{title} <span className="text-[#D6402B]">(필수)</span></span>
        {link && <a href={link.href} target="_blank" rel="noopener" className="text-[12.5px] font-normal text-[#5B616B] underline underline-offset-2 hover:text-[#14171C]">{link.label}</a>}
      </label>
      <div tabIndex={0} aria-label={`${title} 내용`} className="max-h-40 overflow-y-auto border-t border-[#EEF0F3] bg-[#F8F9FA] px-4 py-3">
        {children}
      </div>
    </div>
  )
}

// demoUrls: 홈페이지 모양별 체험 신문 실제 화면 주소 (없으면 샘플 보기 링크를 숨긴다)
export default function ApplyForm({ demoUrls }: { demoUrls?: Record<string, string> | null }) {
  const [state, action] = useActionState<ApplyState, FormData>(submitBetaRequest, {})
  const [plan, setPlan] = useState<PlanId>('standard')
  const [billing, setBilling] = useState<Billing>('monthly')
  // 희망하는 홈페이지 모양 ('' = 상담 후 정함)
  const [design, setDesign] = useState('')
  const [agree, setAgree] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // 요금표에서 요금제를 누르면 그 요금제·결제 방식으로 맞춘다
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<PickPlanDetail>).detail
      if (d?.plan) setPlan(d.plan)
      if (d?.billing) setBilling(d.billing)
    }
    window.addEventListener(PICK_PLAN_EVENT, on)
    return () => window.removeEventListener(PICK_PLAN_EVENT, on)
  }, [])

  const chosen = planById(plan)!
  const pay = firstPayment(chosen, billing)
  const BETA = isBeta()

  if (state.ok) {
    return (
      <div role="status" className="rounded-lg border border-[#14171C] bg-white px-6 py-10 text-center">
        <p className="text-[18px] font-bold">신청을 받았습니다</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[#5B616B]">
          {chosen.name} · {BILLING_LABEL[billing]}{pay ? ` · 첫 결제 ${won(pay.total)}` : ''}{design ? ` · ${HOME_LAYOUTS.find((l) => l.key === design)?.name ?? ''} 홈페이지` : ''}
          <br />
          적어주신 연락처로 영업일 기준 이틀 안에 연락드려 개통 일정과 계약 서류를 안내합니다.
          <br />
          첫 이용료는 정식 오픈 전에 청구서로 먼저 받고 납부를 확인한 뒤 오픈합니다(오픈 전 취소 시 전액 환불). 신청만 한 지금은 비용이 생기지 않습니다.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-7 rounded-lg border border-[#E4E6EA] bg-white p-6 sm:p-8" noValidate>
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="billing" value={billing} />
      <input type="hidden" name="design" value={design} />

      {/* ─── 상품 ─── */}
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-[#14171C]">요금제 <span className="text-[#D6402B]">*</span></legend>
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-4">
          {PLANS.map((p) => (
            <label key={p.id} className={`relative cursor-pointer rounded-md border px-3 py-2.5 text-center transition ${plan === p.id ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
              <input type="radio" name="plan_pick" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)} className="sr-only" />
              {p.pick && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#C2410C] px-2 py-0.5 text-[10.5px] font-bold text-white">추천 · 인기</span>}
              <span className="block text-[14.5px] font-bold">{p.name}</span>
              <span className="block text-[12px] tabular-nums text-[#5B616B]">{p.monthly == null ? '별도 문의' : `월 ${won(p.monthly)}`}</span>
            </label>
          ))}
        </div>
        {chosen.monthly != null && (
          <div role="group" aria-label="결제 방식" className="mt-2 grid grid-cols-2 gap-2">
            {(['monthly', 'annual'] as Billing[]).map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={billing === b}
                onClick={() => setBilling(b)}
                className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-[14px] font-semibold transition ${billing === b ? 'border-[#1D3461] bg-[#1D3461] text-white' : 'border-[#D5D8DD] text-[#3B4048] hover:border-[#1D3461]'}`}
              >
                {BILLING_LABEL[b]}
                {b === 'annual' && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${billing === b ? 'bg-white/90 text-[#16294D]' : 'bg-[#EFF2F7] text-[#16294D]'}`}>{ANNUAL_FREE}</span>}
              </button>
            ))}
          </div>
        )}

        <div aria-live="polite" className="mt-3 rounded-md bg-[#F4F5F7] px-4 py-3.5">
          {pay ? (
            <>
              <p className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#5B616B]">첫 결제 금액 (최종 금액 · 부가세 없음)</span>
                <span className="text-[24px] font-extrabold tabular-nums tracking-[-0.02em] text-[#16294D]">{won(pay.total)}</span>
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px] tabular-nums text-[#5B616B]">
                <li>
                  이용료 {won(pay.price)} ({chosen.name} · {billing === 'annual' ? `12개월을 ${ANNUAL_MONTHS}개월 값으로` : '1개월'}{BETA && <b className="font-semibold text-[#C2410C]">{billing === 'annual' ? ` · ${BETA_PERIOD_LABEL}분 반값` : ' · 베타 반값'}</b>})
                  {BETA && <s className="ml-1 text-[#9AA0A8]">{won(pay.regular)}</s>}
                </li>
                <li>세팅비 {pay.setupFree ? <>0원 <s className="text-[#9AA0A8]">{won(SETUP_FEE)}</s> <b className="font-semibold text-[#C2410C]">(베타 기간 신청 무료 · {SETUP_WAIVER_MONTHS}개월 이상 이용 조건)</b></> : <>{won(pay.setup)} (처음 한 번)</>}</li>
                {billing === 'monthly' && (BETA
                  ? <li>{BETA_PERIOD_LABEL} 매달 {won(pay.price)}, {REGULAR_AFTER_LABEL} 정상가 매달 {won(pay.regular)}</li>
                  : <li>다음 달부터 매달 {won(pay.price)}</li>)}
              </ul>
              <a href={`/imnewsroom/quote?plan=${chosen.id}&billing=${billing}`} target="_blank" rel="noopener" className="mt-2 inline-block text-[12.5px] font-semibold text-[#1D3461] underline underline-offset-2">이 조건으로 견적서 보기 (PDF 저장)</a>
            </>
          ) : (
            <p className="text-[13.5px] text-[#3B4048]">엔터프라이즈는 방문자 수와 필요한 기능을 여쭤본 뒤 견적을 드립니다.</p>
          )}
        </div>
      </fieldset>

      {/* ─── 신청자 ─── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="company" label="언론사(매체) 이름" required>
          <input id="company" name="company" required maxLength={80} placeholder="창간 준비 중이면 예정 이름" className={input} />
        </Field>
        <Field id="contact_name" label="신청자 이름" required>
          <input id="contact_name" name="contact_name" required maxLength={40} autoComplete="name" className={input} />
        </Field>
        <Field id="phone" label="연락처" required>
          <input id="phone" name="phone" required type="tel" inputMode="tel" maxLength={30} autoComplete="tel" placeholder="010-0000-0000" className={input} />
        </Field>
        <Field id="email" label="이메일" required hint="청구서와 개통 안내를 받을 주소">
          <input id="email" name="email" required type="email" maxLength={120} autoComplete="email" className={input} />
        </Field>
        <Field id="domain" label="도메인" hint="없으면 비워 두세요. 도메인 고르기와 구입도 안내해 드립니다.">
          <input id="domain" name="domain" maxLength={120} inputMode="url" placeholder="mynews.co.kr" className={input} />
        </Field>
        <Field id="outlet_count" label="운영 중인 매체 수">
          <select id="outlet_count" name="outlet_count" defaultValue="" className={input}>
            <option value="">선택</option>
            <option>창간 준비 중</option>
            <option>1개</option>
            <option>2~5개</option>
            <option>6개 이상</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field id="current_cms" label="지금 쓰는 기사 관리 프로그램" hint="다른 프로그램을 쓰고 계시면 기존 기사·사진과 옛 기사 주소를 옮겨 드립니다 (세팅비에 포함).">
            <input id="current_cms" name="current_cms" maxLength={80} placeholder="없음 / 프로그램 이름" className={input} />
          </Field>
        </div>
      </div>
      {/* ─── 홈페이지 모양 ─── */}
      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-[#14171C]">홈페이지 모양 <span className="font-normal text-[#5B616B]">(선택)</span></legend>
        <p className="mb-2.5 text-[12.5px] leading-[1.6] text-[#5B616B]">
          마음에 드는 모양을 고르세요.{demoUrls ? ' “샘플 보기”를 누르면 체험 신문의 실제 기사로 열립니다.' : ''} 개통한 뒤에도 요청하면 바꿔 드립니다.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {HOME_LAYOUTS.filter((l) => l.ready).map((l) => (
            <label key={l.key} className={`flex cursor-pointer flex-col gap-2 rounded-md border p-2.5 transition ${design === l.key ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/designs/${l.key}.webp`} width={800} height={600} loading="lazy" alt={`${l.name} ${l.label} 홈페이지 화면 예시`} className="aspect-[4/3] w-full rounded object-cover object-top ring-1 ring-black/10" />
              <span className="flex items-start gap-2">
                <input type="radio" name="design_pick" value={l.key} checked={design === l.key} onChange={() => setDesign(l.key)} className="mt-1 accent-[#1D3461]" />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[13.5px] font-bold">{l.name}</span>
                  <span className="block text-[12px] text-[#5B616B]">{l.label}</span>
                </span>
              </span>
              {demoUrls?.[l.key] && (
                <a href={demoUrls[l.key]} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="rounded border border-[#CBD1DB] bg-white px-2 py-1 text-center text-[12px] font-semibold text-[#1D3461] hover:border-[#1D3461]">샘플 보기 ↗</a>
              )}
            </label>
          ))}
          <label className={`flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-[13px] transition ${design === '' ? 'border-[#1D3461] bg-[#EFF2F7] ring-1 ring-[#1D3461]' : 'border-[#D5D8DD] hover:border-[#14171C]'}`}>
            <input type="radio" name="design_pick" value="" checked={design === ''} onChange={() => setDesign('')} className="accent-[#1D3461]" />
            <span className="font-semibold">상담하고 정할게요</span>
          </label>
        </div>
      </fieldset>

      <Field id="message" label="요청사항" hint="사업자등록증 등 계약 서류는 상담할 때 안내해 드립니다.">
        <textarea id="message" name="message" rows={4} maxLength={2000} placeholder="오픈 희망일, 필요한 기능, 궁금한 점을 자유롭게 적어 주세요." className={`${input} resize-y`} />
      </Field>

      {/* 봇 차단용: 사람에게는 보이지 않는다 */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">웹사이트</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* ─── 동의 ─── */}
      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-center gap-2.5 px-1 text-[14.5px] font-bold">
          <input type="checkbox" checked={agree && agreeTerms} onChange={(e) => { setAgree(e.target.checked); setAgreeTerms(e.target.checked) }} className="h-4 w-4 accent-[#D6402B]" />
          아래 내용에 모두 동의합니다
        </label>
        <Consent name="agree" title="개인정보 수집·이용 동의" checked={agree} onChange={setAgree} link={{ href: `${PRODUCT.path}/privacy`, label: '개인정보처리방침' }}>
          <PolicyDoc sections={applyConsentSections()} compact />
        </Consent>
        <Consent name="agree_terms" title="서비스 이용약관 동의" checked={agreeTerms} onChange={setAgreeTerms} link={{ href: `${PRODUCT.path}/terms`, label: '전문 보기' }}>
          <PolicyDoc sections={termsSections()} compact />
        </Consent>
      </div>

      {state.error && <p role="alert" className="text-[14px] font-semibold text-[#D6402B]">{state.error}</p>}
      <Submit />
    </form>
  )
}
