'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteContract, saveContract, type ContractInput, type Creative } from '@/app/(main)/admin/ads/contracts/actions'
import { AD_SLOTS, slotOf } from '@/lib/ads'
import AdCalendar, { conflicts, firstFree, type Booking } from './AdCalendar'
import { ImagePick } from './AdManager'
import { SlotThumb } from './AdSlotMap'

export type Contract = {
  id: string; advertiser: string; title: string
  contact_name: string | null; contact_phone: string | null; contact_email: string | null
  starts_on: string; ends_on: string
  supply_amount: number; vat_amount: number; paid_amount: number; paid_on: string | null; tax_invoice_on: string | null
  memo: string | null
  banner_ids: string[]; views: number; clicks: number
  // 이 계약으로 예약한 광고 자리·소재
  creatives: (Creative & { id: string })[]
}

type VatMode = 'separate' | 'included' | 'none'
type PayMode = 'unpaid' | 'paid' | 'partial'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0
const comma = (n: number) => (n ? n.toLocaleString('ko-KR') : '')
const total = (c: Pick<Contract, 'supply_amount' | 'vat_amount'>) => c.supply_amount + c.vat_amount
const dot = (d: string | null) => (d ? d.replace(/-/g, '.') : '')
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

function stateOf(c: Contract, today: string) {
  if (c.starts_on > today) return { key: 'soon', label: `시작 전 · ${dot(c.starts_on).slice(5)}부터`, cls: 'status-scheduled' }
  if (c.ends_on < today) return { key: 'done', label: '끝남', cls: 'bg-line text-muted' }
  const left = days(today, c.ends_on)
  if (left <= 7) return { key: 'ending', label: left === 0 ? '오늘 끝남' : `${left}일 뒤 끝남`, cls: 'bg-draft/15 text-[#8A5A00]' }
  return { key: 'live', label: '진행 중', cls: 'bg-published/10 text-published' }
}
function payOf(c: Contract, today: string) {
  const t = total(c)
  if (t > 0 && c.paid_amount >= t) return { key: 'paid', label: '입금 완료', cls: 'bg-published/10 text-published' }
  if (c.paid_amount > 0) return { key: 'partial', label: `일부 입금 · ${won(t - c.paid_amount)} 남음`, cls: 'bg-draft/15 text-[#8A5A00]' }
  if (t === 0) return { key: 'free', label: '무료·교환', cls: 'bg-line text-muted' }
  return { key: 'unpaid', label: '미입금', cls: c.starts_on <= today ? 'bg-danger/10 text-danger' : 'bg-line text-muted' }
}

const FILTERS = [
  { key: 'now', label: '진행 중·예정' },
  { key: 'unpaid', label: '받을 돈 있음' },
  { key: 'done', label: '끝난 계약' },
  { key: 'all', label: '전체' },
] as const

const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export default function AdContracts({ contracts, bookings, today, outletName, outletId }: { contracts: Contract[]; bookings: Booking[]; today: string; outletName: string; outletId: string }) {
  const router = useRouter()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('now')
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)

  const month = today.slice(0, 7)
  const year = today.slice(0, 4)
  const sum = useMemo(() => {
    const live = contracts.filter((c) => c.starts_on <= today && c.ends_on >= today)
    return {
      live: live.length,
      ending: live.filter((c) => days(today, c.ends_on) <= 7).length,
      due: contracts.reduce((n, c) => n + Math.max(0, total(c) - c.paid_amount), 0),
      dueCount: contracts.filter((c) => total(c) - c.paid_amount > 0).length,
      month: contracts.filter((c) => c.starts_on.startsWith(month)).reduce((n, c) => n + total(c), 0),
      year: contracts.filter((c) => c.starts_on.startsWith(year)).reduce((n, c) => n + total(c), 0),
    }
  }, [contracts, today, month, year])

  const list = contracts.filter((c) =>
    filter === 'all' ? true
    : filter === 'done' ? c.ends_on < today
    : filter === 'unpaid' ? total(c) - c.paid_amount > 0
    : c.ends_on >= today)

  function downloadCsv() {
    const head = ['광고주', '광고 내용', '담당자', '연락처', '이메일', '시작일', '끝나는 날', '공급가액', '부가세', '합계', '입금액', '입금일', '세금계산서 발행일', '노출', '클릭', '메모']
    const rows = contracts.map((c) => [c.advertiser, c.title, c.contact_name, c.contact_phone, c.contact_email, c.starts_on, c.ends_on, c.supply_amount, c.vat_amount, total(c), c.paid_amount, c.paid_on, c.tax_invoice_on, c.views, c.clicks, c.memo])
    const blob = new Blob(['﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${outletName}-광고계약-${today}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: '진행 중', v: `${sum.live}건`, sub: sum.ending ? `7일 안에 끝남 ${sum.ending}건 · 재계약 연락` : '곧 끝나는 계약 없음', tone: sum.ending ? 'warn' : '' },
          { k: '받을 돈', v: won(sum.due), sub: sum.dueCount ? `${sum.dueCount}건 입금 확인 필요` : '모두 입금됨', tone: sum.due ? 'alert' : '' },
          { k: `${Number(month.slice(5))}월 새 계약`, v: won(sum.month), sub: '이번 달 시작한 계약 합계(부가세 포함)', tone: '' },
          { k: `${year}년 누적`, v: won(sum.year), sub: '올해 시작한 계약 합계', tone: '' },
        ].map((x) => (
          <div key={x.k} className={`rounded-lg border bg-white px-4 py-3.5 ${x.tone === 'alert' ? 'border-danger/40' : x.tone === 'warn' ? 'border-draft/50' : 'border-line'}`}>
            <p className="text-[12.5px] font-semibold text-muted">{x.k}</p>
            <p className={`mt-1 text-[21px] font-extrabold tabular-nums ${x.tone === 'alert' ? 'text-danger' : ''}`}>{x.v}</p>
            <p className="mt-0.5 text-[11.5px] text-muted">{x.sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`rounded-full border px-3 py-1 text-[12.5px] ${filter === f.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {contracts.length > 0 && <button type="button" onClick={downloadCsv} className="btn-secondary bg-white px-3 py-1.5 text-[13px]">엑셀로 내려받기</button>}
          <button type="button" onClick={() => setEditing('new')} className="btn-primary px-3 py-1.5 text-[13px]">+ 광고 계약 등록</button>
        </div>
      </div>

      {editing && (
        <ContractForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          bookings={bookings}
          outletId={outletId}
          today={today}
          onClose={(saved) => { setEditing(null); if (saved) router.refresh() }}
        />
      )}

      {list.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-normal">광고주 · 내용</th>
                <th className="px-2 py-2.5 font-normal">기간</th>
                <th className="px-2 py-2.5 text-right font-normal">금액(합계)</th>
                <th className="px-2 py-2.5 font-normal">입금 · 세금계산서</th>
                <th className="px-2 py-2.5 text-right font-normal">광고 자리 · 노출 · 클릭</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => {
                const st = stateOf(c, today)
                const pay = payOf(c, today)
                return (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{c.advertiser}</p>
                      <p className="text-[12.5px] text-muted">{c.title}</p>
                      {(c.contact_name || c.contact_phone) && <p className="text-[12px] text-muted">{[c.contact_name, c.contact_phone].filter(Boolean).join(' · ')}</p>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 tabular-nums">
                      {dot(c.starts_on)} ~ {dot(c.ends_on).slice(5)}
                      <span className={`mt-1 block w-fit rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      <span className="font-semibold">{won(total(c))}</span>
                      {c.vat_amount > 0 && <span className="block text-[11.5px] text-muted">공급가 {won(c.supply_amount)}</span>}
                    </td>
                    <td className="px-2 py-3">
                      <span className={`block w-fit rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${pay.cls}`}>{pay.label}</span>
                      <span className="mt-1 block text-[11.5px] text-muted">{c.tax_invoice_on ? `계산서 ${dot(c.tax_invoice_on)}` : total(c) > 0 ? '계산서 미발행' : ''}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      {c.creatives.length > 0 && <span className="block text-[12px] font-semibold">{c.creatives.map((x) => slotOf(x.slot)?.label ?? x.slot).join(' · ')}</span>}
                      {c.creatives.length > 0 && c.starts_on > today ? (
                        <span className="block text-[11.5px] text-[#6D28D9]">{dot(c.starts_on).slice(5)} 0시 자동 게재 예약됨</span>
                      ) : c.banner_ids.length ? (
                        <>
                          {c.views.toLocaleString()} · {c.clicks.toLocaleString()}
                          <span className="block text-[11.5px] text-muted">배너 {c.banner_ids.length}개 · 클릭률 {c.views ? ((c.clicks / c.views) * 100).toFixed(2) : '0.00'}%</span>
                        </>
                      ) : <span className="text-[12px] text-muted">광고 자리 없음</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => setEditing(c)} className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-[12.5px] text-muted hover:border-ink hover:text-ink">고치기</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-10 text-center text-[13.5px] text-muted">
          {contracts.length ? '이 조건에 맞는 계약이 없습니다.' : '아직 등록한 광고 계약이 없습니다. 광고가 들어오면 “+ 광고 계약 등록”으로 적어 두세요.'}
        </p>
      )}
    </div>
  )
}

function ContractForm({ initial, bookings, outletId, today, onClose }: { initial: Contract | null; bookings: Booking[]; outletId: string; today: string; onClose: (saved: boolean) => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [f, setF] = useState({
    advertiser: initial?.advertiser ?? '', title: initial?.title ?? '',
    contact_name: initial?.contact_name ?? '', contact_phone: initial?.contact_phone ?? '', contact_email: initial?.contact_email ?? '',
    starts_on: initial?.starts_on ?? today, ends_on: initial?.ends_on ?? '',
    memo: initial?.memo ?? '', paid_on: initial?.paid_on ?? '', tax_invoice_on: initial?.tax_invoice_on ?? '',
  })
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  // 금액: 공급가·부가세를 저장하고, 화면에서는 입력한 방식대로 보여준다
  const [vat, setVat] = useState<VatMode>(initial ? (initial.vat_amount ? 'separate' : 'none') : 'separate')
  const [amount, setAmount] = useState(initial ? initial.supply_amount : 0)
  const supply = vat === 'included' ? Math.round(amount / 1.1) : amount
  const vatAmount = vat === 'separate' ? Math.round(amount * 0.1) : vat === 'included' ? amount - supply : 0
  const sumAll = supply + vatAmount
  const [pay, setPay] = useState<PayMode>(!initial || !initial.paid_amount ? 'unpaid' : initial.paid_amount >= total(initial) ? 'paid' : 'partial')
  const [paid, setPaid] = useState(initial?.paid_amount ?? 0)
  // 예약할 광고 자리와 소재 (자리마다 하나)
  const [creatives, setCreatives] = useState<Creative[]>(initial?.creatives ?? [])
  const slots = creatives.map((c) => c.slot)
  const toggleSlot = (slot: string) => setCreatives((list) => list.some((c) => c.slot === slot)
    ? list.filter((c) => c.slot !== slot)
    : [...list, { slot, image_url: '', mobile_image_url: '', link_url: list[0]?.link_url ?? '' }])
  const setCreative = (slot: string, p: Partial<Creative>) => setCreatives((list) => list.map((c) => (c.slot === slot ? { ...c, ...p } : c)))
  const clash = conflicts(f.starts_on, f.ends_on, slots, bookings, initial?.id)
  const length = f.starts_on && f.ends_on ? Math.round((Date.parse(f.ends_on) - Date.parse(f.starts_on)) / 864e5) + 1 : 30
  const free = slots.length && clash.length ? firstFree(today, length, slots, bookings, initial?.id) : null

  // 기간 빠르게 정하기
  const addMonths = (n: number) => {
    const d = new Date(`${f.starts_on || today}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + n)
    d.setUTCDate(d.getUTCDate() - 1)
    set({ ends_on: d.toISOString().slice(0, 10) })
  }

  function submit() {
    setError('')
    const input: ContractInput = {
      id: initial?.id, ...f,
      supply_amount: supply, vat_amount: vatAmount,
      paid_amount: pay === 'paid' ? sumAll : pay === 'partial' ? Math.min(paid, sumAll) : 0,
      paid_on: pay === 'unpaid' ? '' : f.paid_on,
      creatives,
    }
    if (clash.length) return setError('고른 기간에 이미 예약된 광고가 있습니다. 달력에서 빈 날짜를 골라 주세요.')
    start(async () => {
      const r = await saveContract(input)
      if (r.error) return setError(r.error)
      onClose(true)
    })
  }

  function remove() {
    if (!initial || !window.confirm(`“${initial.advertiser} · ${initial.title}” 계약을 지울까요?\n\n이 계약으로 예약한 광고도 홈페이지에서 함께 내립니다. 되돌릴 수 없습니다.`)) return
    start(async () => {
      const r = await deleteContract(initial.id)
      if (r.error) return setError(r.error)
      onClose(true)
    })
  }

  const L = 'field-label'
  return (
    <section className="rounded-lg border-2 border-ink bg-white p-5">
      <h2 className="text-[15px] font-bold">{initial ? '광고 계약 고치기' : '새 광고 계약'}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><label className={L}>광고주 *</label><input value={f.advertiser} onChange={(e) => set({ advertiser: e.target.value })} maxLength={80} placeholder="예: OO병원" className="field-input" /></div>
        <div><label className={L}>광고 내용 *</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder="예: 홈 상단 배너 3개월 + 기사 하단" className="field-input" /></div>
        <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-3">
          <div><label className={L}>담당자</label><input value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} maxLength={40} className="field-input" /></div>
          <div><label className={L}>연락처</label><input value={f.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} maxLength={40} placeholder="010-0000-0000" className="field-input" /></div>
          <div className="col-span-2 md:col-span-1"><label className={L}>이메일</label><input type="email" value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} maxLength={120} className="field-input" /></div>
        </div>

        <div className="md:col-span-2">
          <label className={L}>광고 자리 (여러 개 가능)</label>
          <div className="flex flex-wrap gap-2">
            {AD_SLOTS.map((x) => {
              const on = slots.includes(x.id)
              return (
                <button key={x.id} type="button" onClick={() => toggleSlot(x.id)} aria-pressed={on}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-[13px] ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/50'}`}>
                  {on ? '✓' : '+'} {x.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[12px] text-muted">자리를 고르면 아래 달력에 그 자리의 예약 현황이 나옵니다. 기사형 광고·협찬처럼 배너가 없는 계약이면 고르지 않아도 됩니다.</p>
        </div>

        <div className="md:col-span-2">
          <label className={L}>광고 기간 * <span className="font-normal">(게재 기간 — 시작일 0시에 자동으로 나가고, 끝나는 날이 지나면 내려갑니다)</span></label>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={f.starts_on} onChange={(e) => set({ starts_on: e.target.value })} className="field-input !w-auto" />
            <span>~</span>
            <input type="date" value={f.ends_on} min={f.starts_on} onChange={(e) => set({ ends_on: e.target.value })} className="field-input !w-auto" />
            {[1, 3, 6, 12].map((n) => <button key={n} type="button" onClick={() => addMonths(n)} className="rounded border border-line px-2 py-1 text-[12px] hover:border-ink">{n === 12 ? '1년' : `${n}개월`}</button>)}
          </div>
          {slots.length > 0 && (
            <div className="mt-2">
              <AdCalendar slots={slots} bookings={bookings} start={f.starts_on} end={f.ends_on} today={today} exclude={initial?.id}
                onChange={(st, en) => set({ starts_on: st, ends_on: en })} />
              {clash.length > 0 ? (
                <div className="mt-2 rounded bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
                  {clash.map((c) => <p key={c}>⚠ {c}</p>)}
                  {free && <button type="button" onClick={() => set({ starts_on: free, ends_on: new Date(Date.parse(free) + (length - 1) * 864e5).toISOString().slice(0, 10) })} className="mt-1 font-semibold underline underline-offset-2">→ 같은 길이({length}일)로 가장 빠른 빈 날짜: {free.replace(/-/g, '.')}부터</button>}
                </div>
              ) : f.ends_on ? <p className="mt-2 text-[12.5px] text-published">✓ 고른 기간에 {slots.map((x) => slotOf(x)?.label).join(' · ')} 자리가 비어 있습니다.</p> : null}
            </div>
          )}
        </div>

        {creatives.length > 0 && (
          <div className="space-y-3 md:col-span-2">
            <label className={L}>광고 사진 (미리 올려 두면 시작일에 자동으로 나갑니다)</label>
            {creatives.map((c) => {
              const slot = slotOf(c.slot)!
              return (
                <div key={c.slot} className="rounded-md border border-line p-3">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-bold"><SlotThumb id={slot.id} /><span>{slot.label} <span className="font-normal text-muted">· {slot.where} · 권장 {slot.size}</span></span></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ImagePick label="PC용 사진 *" hint="JPG·PNG·GIF" value={c.image_url} onChange={(v) => setCreative(c.slot, { image_url: v })} outletId={outletId} />
                    <ImagePick label="휴대폰용 사진 (없으면 PC용)" hint="세로가 조금 더 긴 사진" value={c.mobile_image_url} onChange={(v) => setCreative(c.slot, { mobile_image_url: v })} outletId={outletId} />
                  </div>
                  <input value={c.link_url} onChange={(e) => setCreative(c.slot, { link_url: e.target.value })} placeholder="광고를 누르면 갈 주소 (예: https://광고주홈페이지.com)" className="field-input mt-2" />
                </div>
              )
            })}
          </div>
        )}

        <div className="md:col-span-2">
          <label className={L}>광고 금액</label>
          <div className="flex flex-wrap items-center gap-2">
            <input inputMode="numeric" value={comma(amount)} onChange={(e) => setAmount(num(e.target.value))} placeholder="0" className="field-input !w-44 text-right tabular-nums" />
            <span>원</span>
            <select value={vat} onChange={(e) => setVat(e.target.value as VatMode)} className="rounded border border-line bg-white px-2 py-2 text-[13px]">
              <option value="separate">부가세 별도 (10% 더함)</option>
              <option value="included">부가세 포함 금액</option>
              <option value="none">부가세 없음</option>
            </select>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted tabular-nums">공급가 {won(supply)} + 부가세 {won(vatAmount)} = <strong className="text-ink">합계 {won(sumAll)}</strong></p>
        </div>

        <div>
          <label className={L}>입금</label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pay} onChange={(e) => setPay(e.target.value as PayMode)} className="rounded border border-line bg-white px-2 py-2 text-[13px]">
              <option value="unpaid">아직 안 받음</option>
              <option value="paid">전액 받음</option>
              <option value="partial">일부 받음</option>
            </select>
            {pay === 'partial' && <><input inputMode="numeric" value={comma(paid)} onChange={(e) => setPaid(num(e.target.value))} className="field-input !w-36 text-right tabular-nums" /><span>원</span></>}
            {pay !== 'unpaid' && <input type="date" value={f.paid_on} onChange={(e) => set({ paid_on: e.target.value })} aria-label="입금일" className="field-input !w-auto" />}
          </div>
        </div>
        <div>
          <label className={L}>세금계산서 발행일</label>
          <input type="date" value={f.tax_invoice_on} onChange={(e) => set({ tax_invoice_on: e.target.value })} className="field-input !w-auto" />
          <p className="mt-1 text-[12px] text-muted">비워 두면 ‘미발행’으로 표시됩니다.</p>
        </div>

        <div className="md:col-span-2"><label className={L}>메모</label><textarea value={f.memo} onChange={(e) => set({ memo: e.target.value })} rows={2} maxLength={2000} placeholder="예: 매월 말 입금, 재계약 시 10% 할인 약속" className="field-input resize-y" /></div>
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={pending || clash.length > 0} className="btn-primary">{pending ? '저장 중…' : initial ? '고친 내용 저장' : '계약 등록'}</button>
        <button type="button" onClick={() => onClose(false)} disabled={pending} className="btn-secondary">취소</button>
        {initial && <button type="button" onClick={remove} disabled={pending} className="ml-auto text-[12.5px] text-muted hover:text-danger">계약 지우기</button>}
      </div>
    </section>
  )
}
