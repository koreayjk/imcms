'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmContract, deleteContract, markInvoiced, saveContract, type ContractInput, type Creative } from '@/app/(main)/admin/ads/contracts/actions'
import RowMenu from './RowMenu'
import { adSlots, slotOf } from '@/lib/ads'
import { useT, useCmsLang } from '@/components/cms/CmsLang'
import type { T } from '@/lib/cms-i18n'
import AdCalendar, { conflicts, firstFree, type Booking } from './AdCalendar'
import { ImagePick } from './AdManager'
import { SlotThumb } from './AdSlotMap'

export type Contract = {
  id: string; advertiser: string; title: string
  contact_name: string | null; contact_phone: string | null; contact_email: string | null
  starts_on: string; ends_on: string
  supply_amount: number; vat_amount: number; paid_amount: number; paid_on: string | null; tax_invoice_on: string | null
  memo: string | null
  status: 'quote' | 'confirmed'; quoted_on: string | null
  biz_no: string | null; biz_name: string | null; biz_ceo: string | null; biz_address: string | null
  biz_type: string | null; biz_item: string | null; invoice_email: string | null; doc_note: string | null
  banner_ids: string[]; views: number; clicks: number
  // 저장한 문서 (최근 것부터)
  docs: { id: string; kind: 'quote' | 'report'; no: string; at: string; sent?: boolean }[]
  // 이 계약으로 예약한 광고 자리·소재
  creatives: (Creative & { id: string })[]
}

type VatMode = 'separate' | 'included' | 'none'
type PayMode = 'unpaid' | 'paid' | 'partial'

type Lang = 'ko' | 'en'
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const wonL = (n: number, lang: Lang) => (lang === 'en' ? `KRW ${Math.round(n).toLocaleString('en-US')}` : `${Math.round(n).toLocaleString('ko-KR')}원`)
const num = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0
const comma = (n: number, lang: Lang = 'ko') => (n ? n.toLocaleString(lang === 'en' ? 'en-US' : 'ko-KR') : '')
const total = (c: Pick<Contract, 'supply_amount' | 'vat_amount'>) => c.supply_amount + c.vat_amount
const dot = (d: string | null) => (d ? d.replace(/-/g, '.') : '')
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

function stateOf(c: Contract, today: string, t: T) {
  if (c.starts_on > today) return { key: 'soon', label: t(`시작 전 · ${dot(c.starts_on).slice(5)}부터`, `Not started · from ${dot(c.starts_on).slice(5)}`), cls: 'status-scheduled' }
  if (c.ends_on < today) return { key: 'done', label: t('끝남', 'Ended'), cls: 'bg-line text-muted' }
  const left = days(today, c.ends_on)
  if (left <= 7) return { key: 'ending', label: left === 0 ? t('오늘 끝남', 'Ends today') : t(`${left}일 뒤 끝남`, `Ends in ${left} ${left === 1 ? 'day' : 'days'}`), cls: 'bg-draft/15 text-[#8A5A00]' }
  return { key: 'live', label: t('진행 중', 'In progress'), cls: 'bg-published/10 text-published' }
}
function payOf(c: Contract, today: string, t: T, won: (n: number) => string) {
  const sum = total(c)
  if (sum > 0 && c.paid_amount >= sum) return { key: 'paid', label: t('입금 완료', 'Paid'), cls: 'bg-published/10 text-published' }
  if (c.paid_amount > 0) return { key: 'partial', label: t(`일부 입금 · ${won(sum - c.paid_amount)} 남음`, `Partly paid · ${won(sum - c.paid_amount)} due`), cls: 'bg-draft/15 text-[#8A5A00]' }
  if (sum === 0) return { key: 'free', label: t('무료·교환', 'Free / barter'), cls: 'bg-line text-muted' }
  return { key: 'unpaid', label: t('미입금', 'Unpaid'), cls: c.starts_on <= today ? 'bg-danger/10 text-danger' : 'bg-line text-muted' }
}

// 계약마다 다음에 할 일 (견적 → 계약 확정 → 세금계산서·입금 → 게재 확인서)
function nextStep(c: Contract, today: string, t: T) {
  const sum = total(c)
  const paid = sum === 0 || c.paid_amount >= sum
  const hasQuote = c.docs.some((x) => x.kind === 'quote')
  const quoteSent = c.docs.some((x) => x.kind === 'quote' && x.sent)
  const hasReport = c.docs.some((x) => x.kind === 'report')
  if (c.status === 'quote') return quoteSent ? t('견적서 메일 보냄 — 광고주가 수락하면 ‘계약 확정’', 'Quote emailed — once the advertiser accepts, click “Confirm contract”') : hasQuote ? t('견적서 저장함 — 광고주에게 보내기', 'Quote saved — send it to the advertiser') : t('견적서 만들어 보내기', 'Create and send a quote')
  if (sum > 0 && !c.tax_invoice_on && !paid) return t('세금계산서 발행 또는 입금 확인', 'Issue the tax invoice or confirm payment')
  if (sum > 0 && !c.tax_invoice_on) return t('세금계산서 발행', 'Issue the tax invoice')
  if (!paid) return t('입금 확인', 'Confirm payment')
  if (c.ends_on < today) return hasReport ? t('끝 (게재 확인서 발급함)', 'Done (delivery report issued)') : t('게재 확인서 보내기', 'Send the delivery report')
  return c.starts_on > today ? t('시작일에 자동 게재', 'Runs automatically on the start date') : t('게재 중', 'Running')
}

const filters = (t: T) => [
  { key: 'now', label: t('진행 중·예정', 'Active & upcoming') },
  { key: 'unpaid', label: t('받을 돈 있음', 'Payment due') },
  { key: 'done', label: t('끝난 계약', 'Ended') },
  { key: 'all', label: t('전체', 'All') },
] as const
type FilterKey = 'now' | 'unpaid' | 'done' | 'all'

const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export default function AdContracts({ contracts, bookings, today, outletName, outletId }: { contracts: Contract[]; bookings: Booking[]; today: string; outletName: string; outletId: string }) {
  const t = useT()
  const lang = useCmsLang()
  const won = (n: number) => wonL(n, lang)
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('now')
  const [editing, setEditing] = useState<Contract | 'new' | null>(null)
  const [invoicing, setInvoicing] = useState<Contract | null>(null)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [busy, startBusy] = useTransition()
  // 새 계약의 문서 안내(입금 계좌 등)는 가장 최근 계약 것을 미리 넣는다
  const lastNote = contracts.find((c) => c.doc_note)?.doc_note ?? ''
  function confirm(c: Contract) {
    if (!window.confirm(t(`${c.advertiser} 광고를 계약 확정할까요?\n\n고른 광고 자리가 ${dot(c.starts_on)} ~ ${dot(c.ends_on)}로 예약되고, 시작일에 자동으로 나갑니다.`, `Confirm the contract for ${c.advertiser}?\n\nThe chosen ad placements will be reserved for ${dot(c.starts_on)} – ${dot(c.ends_on)} and will run automatically from the start date.`))) return
    startBusy(async () => { const r = await confirmContract(c.id); setMsg(r); router.refresh() })
  }

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
    const head = [t('광고주', 'Advertiser'), t('광고 내용', 'Ad description'), t('담당자', 'Contact person'), t('연락처', 'Phone'), t('이메일', 'Email'), t('시작일', 'Start date'), t('끝나는 날', 'End date'), t('공급가액', 'Net amount'), t('부가세', 'VAT'), t('합계', 'Total'), t('입금액', 'Amount paid'), t('입금일', 'Date paid'), t('세금계산서 발행일', 'Tax invoice date'), t('노출', 'Impressions'), t('클릭', 'Clicks'), t('메모', 'Memo')]
    const rows = contracts.map((c) => [c.advertiser, c.title, c.contact_name, c.contact_phone, c.contact_email, c.starts_on, c.ends_on, c.supply_amount, c.vat_amount, total(c), c.paid_amount, c.paid_on, c.tax_invoice_on, c.views, c.clicks, c.memo])
    const blob = new Blob(['﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${outletName}-${t('광고계약', 'ad-contracts')}-${today}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: t('진행 중', 'In progress'), v: t(`${sum.live}건`, String(sum.live)), sub: sum.ending ? t(`7일 안에 끝남 ${sum.ending}건 · 재계약 연락`, `${sum.ending} ending within 7 days · contact about renewal`) : t('곧 끝나는 계약 없음', 'No contracts ending soon'), tone: sum.ending ? 'warn' : '' },
          { k: t('받을 돈', 'Amount due'), v: won(sum.due), sub: sum.dueCount ? t(`${sum.dueCount}건 입금 확인 필요`, `${sum.dueCount} ${sum.dueCount === 1 ? 'payment needs' : 'payments need'} checking`) : t('모두 입금됨', 'All paid'), tone: sum.due ? 'alert' : '' },
          { k: t(`${Number(month.slice(5))}월 새 계약`, `New contracts in ${MONTHS_EN[Number(month.slice(5)) - 1]}`), v: won(sum.month), sub: t('이번 달 시작한 계약 합계(부가세 포함)', 'Total of contracts starting this month (VAT included)'), tone: '' },
          { k: t(`${year}년 누적`, `${year} to date`), v: won(sum.year), sub: t('올해 시작한 계약 합계', 'Total of contracts starting this year'), tone: '' },
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
          {filters(t).map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`rounded-full border px-3 py-1 text-[12.5px] ${filter === f.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-ink hover:text-ink'}`}>{f.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {contracts.length > 0 && <button type="button" onClick={downloadCsv} className="btn-secondary bg-white px-3 py-1.5 text-[13px]">{t('엑셀로 내려받기', 'Download as spreadsheet')}</button>}
          <button type="button" onClick={() => setEditing('new')} className="btn-primary px-3 py-1.5 text-[13px]">{t('+ 광고 계약 등록', '+ Add ad contract')}</button>
        </div>
      </div>

      {editing && (
        <ContractForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          bookings={bookings}
          outletId={outletId}
          lastNote={lastNote}
          today={today}
          onClose={(saved) => { setEditing(null); if (saved) router.refresh() }}
        />
      )}

      {invoicing && <InvoicePanel c={invoicing} today={today} onClose={(saved) => { setInvoicing(null); if (saved) router.refresh() }} />}
      {msg.error && <p role="alert" className="rounded bg-danger/5 px-4 py-2.5 text-[13px] text-danger">{msg.error}</p>}
      {msg.ok && !msg.error && <p role="status" className="rounded bg-published/5 px-4 py-2.5 text-[13px] text-published">{msg.ok}</p>}

      {list.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-white">
          <table className="table-cards w-full text-[13px] md:min-w-[860px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="px-4 py-2.5 font-normal">{t('광고주 · 내용', 'Advertiser · Description')}</th>
                <th className="px-2 py-2.5 font-normal">{t('기간', 'Period')}</th>
                <th className="px-2 py-2.5 text-right font-normal">{t('금액(합계)', 'Amount (total)')}</th>
                <th className="px-2 py-2.5 font-normal">{t('입금 · 세금계산서', 'Payment · Tax invoice')}</th>
                <th className="px-2 py-2.5 text-right font-normal">{t('광고 자리 · 노출 · 클릭', 'Placement · Impressions · Clicks')}</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((c) => {
                const st = stateOf(c, today, t)
                const pay = payOf(c, today, t, won)
                return (
                  <tr key={c.id} className="align-top">
                    <td className="tc-full px-4 py-3">
                      <p className="font-semibold">{c.advertiser}</p>
                      <p className="text-[12.5px] text-muted">{c.title}</p>
                      {(c.contact_name || c.contact_phone) && <p className="text-[12px] text-muted">{[c.contact_name, c.contact_phone].filter(Boolean).join(' · ')}</p>}
                      <p className="mt-1 text-[12px] font-semibold text-review">{t('다음 할 일', 'Next step')}: {nextStep(c, today, t)}</p>
                      {c.docs.length > 0 && (
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-muted">
                          {c.docs.slice(0, 4).map((x) => (
                            <a key={x.id} href={`/doc/saved/${x.id}`} target="_blank" rel="noopener" className="hover:text-ink hover:underline">📄 {x.kind === 'quote' ? t('견적서', 'Quote') : t('확인서', 'Report')} {x.no}{x.sent ? ' ✉' : ''}</a>
                          ))}
                          {c.docs.length > 4 && <span>{t(`외 ${c.docs.length - 4}건`, `+${c.docs.length - 4} more`)}</span>}
                        </p>
                      )}
                    </td>
                    <td data-label={t('기간', 'Period')} className="whitespace-nowrap px-2 py-3 tabular-nums">
                      {dot(c.starts_on)} ~ {dot(c.ends_on).slice(5)}
                      {c.status === 'quote'
                        ? <span className="mt-1 block w-fit rounded bg-[#EDE9FE] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#6D28D9]">{t('견적 · 자리 아직 안 잡음', 'Quote · placement not reserved yet')}</span>
                        : <span className={`mt-1 block w-fit rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${st.cls}`}>{st.label}</span>}
                    </td>
                    <td data-label={t('금액', 'Amount')} className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      <span className="font-semibold">{won(total(c))}</span>
                      {c.vat_amount > 0 && <span className="block text-[11.5px] text-muted">{t('공급가', 'Net')} {won(c.supply_amount)}</span>}
                    </td>
                    <td data-label={t('입금 · 계산서', 'Payment · Invoice')} className="px-2 py-3">
                      <span className={`block w-fit rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${pay.cls}`}>{pay.label}</span>
                      <span className="mt-1 block text-[11.5px] text-muted">{c.tax_invoice_on ? t(`계산서 ${dot(c.tax_invoice_on)}`, `Invoice ${dot(c.tax_invoice_on)}`) : total(c) > 0 ? t('계산서 미발행', 'Invoice not issued') : ''}</span>
                    </td>
                    <td data-label={t('광고 자리', 'Placement')} className="whitespace-nowrap px-2 py-3 text-right tabular-nums">
                      {c.creatives.length > 0 && <span className="block text-[12px] font-semibold">{c.creatives.map((x) => slotOf(x.slot, lang)?.label ?? x.slot).join(' · ')}</span>}
                      {c.creatives.length > 0 && c.status === 'quote' ? (
                        <span className="block text-[11.5px] text-muted">{t('계약 확정하면 예약됩니다', 'Reserved once the contract is confirmed')}</span>
                      ) : c.creatives.length > 0 && c.starts_on > today ? (
                        <span className="block text-[11.5px] text-[#6D28D9]">{t(`${dot(c.starts_on).slice(5)} 0시 자동 게재 예약됨`, `Scheduled to run automatically at 12 AM on ${dot(c.starts_on).slice(5)}`)}</span>
                      ) : c.banner_ids.length ? (
                        <>
                          {c.views.toLocaleString()} · {c.clicks.toLocaleString()}
                          <span className="block text-[11.5px] text-muted">{t(`배너 ${c.banner_ids.length}개`, `${c.banner_ids.length} ${c.banner_ids.length === 1 ? 'banner' : 'banners'}`)} · {t('클릭률', 'CTR')} {c.views ? ((c.clicks / c.views) * 100).toFixed(2) : '0.00'}%</span>
                        </>
                      ) : <span className="text-[12px] text-muted">{t('광고 자리 없음', 'No placement')}</span>}
                    </td>
                    <td className="tc-full px-3 py-3 text-right">
                      <RowMenu disabled={busy} items={[
                        { label: t('고치기', 'Edit'), onClick: () => { setMsg({}); setEditing(c) } },
                        c.status === 'quote' && { label: t('계약 확정 (자리 예약)', 'Confirm contract (reserve placement)'), tone: 'strong' as const, onClick: () => confirm(c) },
                        { label: t('견적서 (보내기·PDF)', 'Quote (send / PDF)'), href: `/doc/ad/${c.id}/quote`, newTab: true },
                        total(c) > 0 && { label: c.tax_invoice_on ? t('세금계산서 정보 (발행함)', 'Tax invoice info (issued)') : t('세금계산서 발행 정보', 'Tax invoice info'), onClick: () => setInvoicing(c) },
                        { label: t('게재 확인서 (보내기·PDF)', 'Delivery report (send / PDF)'), href: `/doc/ad/${c.id}/report`, newTab: true },
                      ]} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-10 text-center text-[13.5px] text-muted">
          {contracts.length ? t('이 조건에 맞는 계약이 없습니다.', 'No contracts match this filter.') : t('아직 등록한 광고 계약이 없습니다. 광고가 들어오면 “+ 광고 계약 등록”으로 적어 두세요.', 'No ad contracts yet. When an ad comes in, log it with “+ Add ad contract”.')}
        </p>
      )}
    </div>
  )
}

function ContractForm({ initial, bookings, outletId, lastNote, today, onClose }: { initial: Contract | null; bookings: Booking[]; outletId: string; lastNote: string; today: string; onClose: (saved: boolean) => void }) {
  const t = useT()
  const lang = useCmsLang()
  const won = (n: number) => wonL(n, lang)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [f, setF] = useState({
    advertiser: initial?.advertiser ?? '', title: initial?.title ?? '',
    contact_name: initial?.contact_name ?? '', contact_phone: initial?.contact_phone ?? '', contact_email: initial?.contact_email ?? '',
    starts_on: initial?.starts_on ?? today, ends_on: initial?.ends_on ?? '',
    memo: initial?.memo ?? '', paid_on: initial?.paid_on ?? '', tax_invoice_on: initial?.tax_invoice_on ?? '',
    quoted_on: initial?.quoted_on ?? today,
    biz_no: initial?.biz_no ?? '', biz_name: initial?.biz_name ?? '', biz_ceo: initial?.biz_ceo ?? '', biz_address: initial?.biz_address ?? '',
    biz_type: initial?.biz_type ?? '', biz_item: initial?.biz_item ?? '', invoice_email: initial?.invoice_email ?? '',
    doc_note: initial ? initial.doc_note ?? '' : lastNote,
  })
  const [status, setStatus] = useState<'quote' | 'confirmed'>(initial?.status ?? 'quote')
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
  const clash = conflicts(f.starts_on, f.ends_on, slots, bookings, initial?.id, lang)
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
      status,
      creatives,
    }
    if (clash.length && status === 'confirmed') return setError(t('고른 기간에 이미 예약된 광고가 있습니다. 달력에서 빈 날짜를 골라 주세요.', 'There is already an ad booked in the selected period. Pick open dates on the calendar.'))
    start(async () => {
      const r = await saveContract(input)
      if (r.error) return setError(r.error)
      onClose(true)
    })
  }

  function remove() {
    if (!initial || !window.confirm(t(`“${initial.advertiser} · ${initial.title}” 계약을 지울까요?\n\n이 계약으로 예약한 광고도 홈페이지에서 함께 내립니다. 되돌릴 수 없습니다.`, `Delete the contract “${initial.advertiser} · ${initial.title}”?\n\nThe ads reserved by this contract will also be taken down from the homepage. This cannot be undone.`))) return
    start(async () => {
      const r = await deleteContract(initial.id)
      if (r.error) return setError(r.error)
      onClose(true)
    })
  }

  const L = 'field-label'
  return (
    <section className="rounded-lg border-2 border-ink bg-white p-5">
      <h2 className="text-[15px] font-bold">{initial ? t('광고 계약 고치기', 'Edit ad contract') : t('새 광고 계약', 'New ad contract')}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
        {([['quote', t('견적 단계', 'Quote stage'), t('견적서를 먼저 보냅니다. 광고 자리는 아직 잡지 않습니다.', 'Send a quote first. No placement is reserved yet.')], ['confirmed', t('계약 확정', 'Confirmed'), t('광고 자리를 예약하고 시작일에 자동으로 나갑니다.', 'Reserves the placement and runs automatically from the start date.')]] as const).map(([k, label, hint]) => (
          <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={status === k} title={hint}
            className={`rounded-full border px-3 py-1 ${status === k ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-ink'}`}>{label}</button>
        ))}
        <span className="text-[12px] text-muted">{status === 'quote' ? t('견적서를 먼저 보냅니다. 광고 자리는 아직 잡지 않습니다(사진은 미리 올려 둘 수 있어요).', 'Send a quote first. No placement is reserved yet (you can upload the images ahead of time).') : t('광고 자리를 예약하고 시작일에 자동으로 나갑니다.', 'Reserves the placement and runs automatically from the start date.')}</span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div><label className={L}>{t('광고주 *', 'Advertiser *')}</label><input value={f.advertiser} onChange={(e) => set({ advertiser: e.target.value })} maxLength={80} placeholder={t('예: OO병원', 'e.g. Sunrise Clinic')} className="field-input" /></div>
        <div><label className={L}>{t('광고 내용 *', 'Ad description *')}</label><input value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={t('예: 홈 상단 배너 3개월 + 기사 하단', 'e.g. Home top banner for 3 months + below story')} className="field-input" /></div>
        <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-3">
          <div><label className={L}>{t('담당자', 'Contact person')}</label><input value={f.contact_name} onChange={(e) => set({ contact_name: e.target.value })} maxLength={40} className="field-input" /></div>
          <div><label className={L}>{t('연락처', 'Phone')}</label><input value={f.contact_phone} onChange={(e) => set({ contact_phone: e.target.value })} maxLength={40} placeholder="010-0000-0000" className="field-input" /></div>
          <div className="col-span-2 md:col-span-1"><label className={L}>{t('이메일', 'Email')}</label><input type="email" value={f.contact_email} onChange={(e) => set({ contact_email: e.target.value })} maxLength={120} className="field-input" /></div>
        </div>

        <div className="md:col-span-2">
          <label className={L}>{t('광고 자리 (여러 개 가능)', 'Ad placements (you can choose several)')}</label>
          <div className="flex flex-wrap gap-2">
            {adSlots(lang).map((x) => {
              const on = slots.includes(x.id)
              return (
                <button key={x.id} type="button" onClick={() => toggleSlot(x.id)} aria-pressed={on}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-1.5 text-[13px] ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink/50'}`}>
                  {on ? '✓' : '+'} {x.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-[12px] text-muted">{t('자리를 고르면 아래 달력에 그 자리의 예약 현황이 나옵니다. 기사형 광고·협찬처럼 배너가 없는 계약이면 고르지 않아도 됩니다.', 'Once you choose a placement, the calendar below shows its bookings. For contracts without a banner, such as sponsored articles, you can leave this empty.')}</p>
        </div>

        <div className="md:col-span-2">
          <label className={L}>{t('광고 기간 *', 'Ad period *')} <span className="font-normal">{t('(게재 기간 — 시작일 0시에 자동으로 나가고, 끝나는 날이 지나면 내려갑니다)', '(run period — the ad goes live automatically at midnight on the start date and comes down after the end date)')}</span></label>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={f.starts_on} onChange={(e) => set({ starts_on: e.target.value })} className="field-input !w-auto" />
            <span>~</span>
            <input type="date" value={f.ends_on} min={f.starts_on} onChange={(e) => set({ ends_on: e.target.value })} className="field-input !w-auto" />
            {[1, 3, 6, 12].map((n) => <button key={n} type="button" onClick={() => addMonths(n)} className="rounded border border-line px-2 py-1 text-[12px] hover:border-ink">{n === 12 ? t('1년', '1 year') : t(`${n}개월`, `${n} ${n === 1 ? 'month' : 'months'}`)}</button>)}
          </div>
          {slots.length > 0 && (
            <div className="mt-2">
              <AdCalendar slots={slots} bookings={bookings} start={f.starts_on} end={f.ends_on} today={today} exclude={initial?.id}
                onChange={(st, en) => set({ starts_on: st, ends_on: en })} />
              {clash.length > 0 ? (
                <div className="mt-2 rounded bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
                  {clash.map((c) => <p key={c}>⚠ {c}</p>)}
                  {free && <button type="button" onClick={() => set({ starts_on: free, ends_on: new Date(Date.parse(free) + (length - 1) * 864e5).toISOString().slice(0, 10) })} className="mt-1 font-semibold underline underline-offset-2">{t(`→ 같은 길이(${length}일)로 가장 빠른 빈 날짜: ${free.replace(/-/g, '.')}부터`, `→ Earliest open dates for the same length (${length} ${length === 1 ? 'day' : 'days'}): from ${free.replace(/-/g, '.')}`)}</button>}
                </div>
              ) : f.ends_on ? <p className="mt-2 text-[12.5px] text-published">{t(`✓ 고른 기간에 ${slots.map((x) => slotOf(x)?.label).join(' · ')} 자리가 비어 있습니다.`, `✓ ${slots.map((x) => slotOf(x, lang)?.label).join(' · ')} ${slots.length === 1 ? 'is' : 'are'} open in the selected period.`)}</p> : null}
            </div>
          )}
        </div>

        {creatives.length > 0 && (
          <div className="space-y-3 md:col-span-2">
            <label className={L}>{t('광고 사진 (미리 올려 두면 시작일에 자동으로 나갑니다)', 'Ad images (upload ahead of time and they run automatically on the start date)')}</label>
            {creatives.map((c) => {
              const slot = slotOf(c.slot, lang)!
              return (
                <div key={c.slot} className="rounded-md border border-line p-3">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-bold"><SlotThumb id={slot.id} /><span>{slot.label} <span className="font-normal text-muted">· {slot.where} · {t('권장', 'Recommended')} {slot.size}</span></span></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ImagePick label={t('PC용 사진 *', 'Desktop image *')} hint={t('JPG·PNG·GIF', 'JPG, PNG or GIF')} value={c.image_url} onChange={(v) => setCreative(c.slot, { image_url: v })} outletId={outletId} />
                    <ImagePick label={t('휴대폰용 사진 (없으면 PC용)', 'Mobile image (desktop image if left out)')} hint={t('세로가 조금 더 긴 사진', 'A slightly taller image')} value={c.mobile_image_url} onChange={(v) => setCreative(c.slot, { mobile_image_url: v })} outletId={outletId} />
                  </div>
                  <input value={c.link_url} onChange={(e) => setCreative(c.slot, { link_url: e.target.value })} placeholder={t('광고를 누르면 갈 주소 (예: https://광고주홈페이지.com)', 'Link address when the ad is clicked (e.g. https://advertiser-website.com)')} className="field-input mt-2" />
                </div>
              )
            })}
          </div>
        )}

        <div className="md:col-span-2">
          <label className={L}>{t('광고 금액', 'Ad amount')}</label>
          <div className="flex flex-wrap items-center gap-2">
            <input inputMode="numeric" value={comma(amount, lang)} onChange={(e) => setAmount(num(e.target.value))} placeholder="0" className="field-input !w-44 text-right tabular-nums" />
            <span>{t('원', 'KRW')}</span>
            <select value={vat} onChange={(e) => setVat(e.target.value as VatMode)} className="rounded border border-line bg-white px-2 py-2 text-[13px]">
              <option value="separate">{t('부가세 별도 (10% 더함)', 'VAT not included (add 10%)')}</option>
              <option value="included">{t('부가세 포함 금액', 'VAT included')}</option>
              <option value="none">{t('부가세 없음', 'No VAT')}</option>
            </select>
          </div>
          <p className="mt-1.5 text-[12.5px] text-muted tabular-nums">{t('공급가', 'Net')} {won(supply)} + {t('부가세', 'VAT')} {won(vatAmount)} = <strong className="text-ink">{t('합계', 'Total')} {won(sumAll)}</strong></p>
        </div>

        <div>
          <label className={L}>{t('입금', 'Payment')}</label>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pay} onChange={(e) => setPay(e.target.value as PayMode)} className="rounded border border-line bg-white px-2 py-2 text-[13px]">
              <option value="unpaid">{t('아직 안 받음', 'Not received yet')}</option>
              <option value="paid">{t('전액 받음', 'Received in full')}</option>
              <option value="partial">{t('일부 받음', 'Partly received')}</option>
            </select>
            {pay === 'partial' && <><input inputMode="numeric" value={comma(paid, lang)} onChange={(e) => setPaid(num(e.target.value))} className="field-input !w-36 text-right tabular-nums" /><span>{t('원', 'KRW')}</span></>}
            {pay !== 'unpaid' && <input type="date" value={f.paid_on} onChange={(e) => set({ paid_on: e.target.value })} aria-label={t('입금일', 'Date paid')} className="field-input !w-auto" />}
          </div>
        </div>
        <div>
          <label className={L}>{t('세금계산서 발행일', 'Tax invoice date')}</label>
          <input type="date" value={f.tax_invoice_on} onChange={(e) => set({ tax_invoice_on: e.target.value })} className="field-input !w-auto" />
          <p className="mt-1 text-[12px] text-muted">{t('비워 두면 ‘미발행’으로 표시됩니다.', 'If left blank, it is shown as “not issued”.')}</p>
        </div>

        <details className="rounded-md border border-line px-4 py-3 md:col-span-2" open={!!initial?.biz_no}>
          <summary className="cursor-pointer text-[13.5px] font-bold">{t('광고주 사업자 정보', 'Advertiser business details')} <span className="font-normal text-muted">{t('(세금계산서 발행용 — 광고주에게 사업자등록증을 받아 적어 두세요)', '(for issuing the tax invoice — get the business registration certificate from the advertiser and enter the details)')}</span></summary>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div><label className={L}>{t('사업자등록번호', 'Business registration no.')}</label><input value={f.biz_no} onChange={(e) => set({ biz_no: e.target.value })} placeholder="000-00-00000" maxLength={14} className="field-input tabular-nums" /></div>
            <div><label className={L}>{t('상호(법인명)', 'Company name')}</label><input value={f.biz_name} onChange={(e) => set({ biz_name: e.target.value })} placeholder={f.advertiser || t('사업자등록증의 상호', 'Name on the business registration')} maxLength={80} className="field-input" /></div>
            <div><label className={L}>{t('대표자', 'Representative')}</label><input value={f.biz_ceo} onChange={(e) => set({ biz_ceo: e.target.value })} maxLength={40} className="field-input" /></div>
            <div className="md:col-span-3"><label className={L}>{t('사업장 주소', 'Business address')}</label><input value={f.biz_address} onChange={(e) => set({ biz_address: e.target.value })} maxLength={200} className="field-input" /></div>
            <div><label className={L}>{t('업태', 'Business type')}</label><input value={f.biz_type} onChange={(e) => set({ biz_type: e.target.value })} placeholder={t('예: 보건업', 'e.g. Healthcare')} maxLength={60} className="field-input" /></div>
            <div><label className={L}>{t('종목', 'Business item')}</label><input value={f.biz_item} onChange={(e) => set({ biz_item: e.target.value })} placeholder={t('예: 종합병원', 'e.g. General hospital')} maxLength={60} className="field-input" /></div>
            <div><label className={L}>{t('세금계산서 받을 이메일', 'Email for tax invoice')}</label><input type="email" value={f.invoice_email} onChange={(e) => set({ invoice_email: e.target.value })} maxLength={120} className="field-input" /></div>
          </div>
        </details>

        <div><label className={L}>{t('견적일', 'Quote date')}</label><input type="date" value={f.quoted_on} onChange={(e) => set({ quoted_on: e.target.value })} className="field-input !w-auto" /></div>
        <div><label className={L}>{t('견적서·확인서에 넣을 안내', 'Note for the quote and report')}</label><textarea value={f.doc_note} onChange={(e) => set({ doc_note: e.target.value })} rows={2} maxLength={500} placeholder={t('예: 입금 계좌 OO은행 123-456-789012 (예금주 OO신문)', 'e.g. Bank account: OO Bank 123-456-789012 (account holder: OO Daily)')} className="field-input resize-y" /><p className="mt-1 text-[12px] text-muted">{t('새 계약에는 지난 계약의 안내가 미리 들어갑니다.', 'New contracts are pre-filled with the note from the previous contract.')}</p></div>

        <div className="md:col-span-2"><label className={L}>{t('메모', 'Memo')} <span className="font-normal">{t('(우리끼리만 보는 메모 — 문서에는 나가지 않습니다)', '(internal only — not shown on documents)')}</span></label><textarea value={f.memo} onChange={(e) => set({ memo: e.target.value })} rows={2} maxLength={2000} placeholder={t('예: 매월 말 입금, 재계약 시 10% 할인 약속', 'e.g. Pays at the end of each month; promised 10% off on renewal')} className="field-input resize-y" /></div>
      </div>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={pending || (clash.length > 0 && status === 'confirmed')} className="btn-primary">{pending ? t('저장 중…', 'Saving…') : status === 'quote' ? (initial ? t('견적 저장', 'Save quote') : t('견적 저장 (자리는 나중에 예약)', 'Save quote (reserve placement later)')) : initial ? t('고친 내용 저장', 'Save changes') : t('계약 등록 (자리 예약)', 'Add contract (reserve placement)')}</button>
        <button type="button" onClick={() => onClose(false)} disabled={pending} className="btn-secondary">{t('취소', 'Cancel')}</button>
        {initial && <button type="button" onClick={remove} disabled={pending} className="ml-auto text-[12.5px] text-muted hover:text-danger">{t('계약 지우기', 'Delete contract')}</button>}
      </div>
    </section>
  )
}

// 세금계산서 발행 정보: 홈택스(전자세금계산서)에 옮겨 적을 내용을 한곳에 모으고, 발행한 날을 기록한다
function InvoicePanel({ c, today, onClose }: { c: Contract; today: string; onClose: (saved: boolean) => void }) {
  const t = useT()
  const lang = useCmsLang()
  const won = (n: number) => wonL(n, lang)
  const [day, setDay] = useState(c.tax_invoice_on ?? today)
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  // [고정 이름, 화면에 보일 이름, 값]
  const rows: [string, string, string][] = [
    ['bizno', t('공급받는자 사업자등록번호', 'Recipient business registration no.'), c.biz_no ?? ''],
    ['name', t('상호(법인명)', 'Company name'), c.biz_name || c.advertiser],
    ['ceo', t('대표자', 'Representative'), c.biz_ceo ?? ''],
    ['address', t('사업장 주소', 'Business address'), c.biz_address ?? ''],
    ['type', t('업태 / 종목', 'Business type / item'), [c.biz_type, c.biz_item].filter(Boolean).join(' / ')],
    ['email', t('받을 이메일', 'Email to receive'), c.invoice_email || c.contact_email || ''],
    ['item', t('품목', 'Item'), t(`광고비 (${c.title})`, `Advertising fee (${c.title})`)],
    ['supply', t('공급가액', 'Net amount'), String(c.supply_amount)],
    ['vat', t('세액', 'Tax amount'), String(c.vat_amount)],
    ['total', t('합계금액', 'Total amount'), String(total(c))],
  ]
  const missing = !c.biz_no
  return (
    <section className="rounded-lg border-2 border-review bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold">{t('세금계산서 발행 정보', 'Tax invoice info')} · {c.advertiser}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{t('전자세금계산서는 국세청 홈택스(무료)에서 발행합니다. 아래 값을 복사해 붙여넣으세요. 우리 매체(공급자) 정보는 홈택스에 로그인하면 자동으로 들어갑니다.', 'Electronic tax invoices are issued for free on the National Tax Service’s Hometax site. Copy and paste the values below. Your outlet’s (supplier) details are filled in automatically when you log in to Hometax.')}</p>
        </div>
        <a href="https://www.hometax.go.kr" target="_blank" rel="noopener" className="rounded-md bg-[#1A73E8] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#1765CC]">{t('홈택스 열기 ↗', 'Open Hometax ↗')}</a>
      </div>
      {missing && <p className="mt-3 rounded bg-draft/10 px-3 py-2 text-[12.5px] text-[#6B5F22]">{t('⚠ 광고주 사업자등록번호가 없습니다. ‘고치기’ → 광고주 사업자 정보에 먼저 적어 주세요.', '⚠ The advertiser’s business registration number is missing. Enter it first under “Edit” → Advertiser business details.')}</p>}
      <dl className="mt-3 divide-y divide-line rounded-md border border-line text-[13px]">
        {rows.map(([k, label, v]) => (
          <div key={k} className="flex items-center gap-3 px-3 py-2">
            <dt className="w-28 shrink-0 text-muted sm:w-40">{label}</dt>
            <dd className="min-w-0 flex-1 truncate font-medium tabular-nums">{/^\d+$/.test(v) && k !== 'bizno' ? won(Number(v)) : v || <span className="text-muted">{t('없음', 'None')}</span>}</dd>
            {v && <CopyBtn text={v} />}
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12px] text-muted">{t('작성일자는 보통 광고를 시작한 날(또는 그 달 말일)로 적습니다. 회사마다 다를 수 있으니 담당 세무사와 맞춰 주세요.', 'The issue date is usually the day the ad starts (or the last day of that month). It can differ by company, so check with your tax accountant.')}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span>{t('홈택스에서 발행한 날', 'Date issued on Hometax')}</span>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="field-input !w-auto" />
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await markInvoiced(c.id, day); if (r.error) return setError(r.error); onClose(true) })} className="btn-primary px-3 py-1.5 text-[13px]">{t('발행했어요 · 기록', 'Issued — record it')}</button>
        {c.tax_invoice_on && <button type="button" disabled={pending} onClick={() => start(async () => { const r = await markInvoiced(c.id, null); if (r.error) return setError(r.error); onClose(true) })} className="text-[12.5px] text-muted underline underline-offset-2">{t('발행 기록 지우기', 'Clear issuance record')}</button>}
        <button type="button" onClick={() => onClose(false)} className="btn-secondary px-3 py-1.5 text-[13px]">{t('닫기', 'Close')}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-[13px] text-danger">{error}</p>}
    </section>
  )
}

function CopyBtn({ text }: { text: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text) } catch { window.prompt(t('복사하세요', 'Copy this'), text) } setDone(true); setTimeout(() => setDone(false), 1500) }}
      className={`shrink-0 rounded px-2 py-0.5 text-[12px] font-semibold ${done ? 'bg-published text-white' : 'bg-line/70 hover:bg-line'}`}>{done ? t('복사됨', 'Copied') : t('복사', 'Copy')}</button>
  )
}
