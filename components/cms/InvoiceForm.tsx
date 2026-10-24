'use client'

import { useEffect, useState, useTransition, useActionState } from 'react'
import { invoiceDraft, saveInvoice, sendInvoicePreview, type FormState } from '@/app/(main)/support/actions'
import { TAX_NOTE, invoiceTotals, won, type InvoiceItem } from '@/lib/support'
import PendingButton from './PendingButton'

export default function InvoiceForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveInvoice, {})
  const [items, setItems] = useState<InvoiceItem[]>([{ name: 'IM 뉴스룸 이용료', qty: 1, unit_price: 0 }])
  const t = invoiceTotals(items)
  const now = new Date()
  const [outletId, setOutletId] = useState('')
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  // 매체·청구 월을 고르면 요금표대로 항목을 채운다 (직접 고친 뒤에는 바꾸지 않고, “요금표대로 채우기”를 누르면 다시 채운다)
  const [edited, setEdited] = useState(false)
  const [note, setNote] = useState('')
  const [filling, startFill] = useTransition()
  // 베타 반값·첫 청구 월: 처음엔 그 매체의 자동 청구 설정을 따르고, 여기서 고르면 이번 청구서 계산에 쓴다
  const [beta, setBeta] = useState(false)
  const [start, setStart] = useState('')
  const [picked, setPicked] = useState(false)
  const [auto, setAuto] = useState(true)
  const [enableAuto, setEnableAuto] = useState(true)
  const fill = (over?: { beta: boolean; start: string }, fresh = false) => {
    if (!outletId || !/^\d{4}-\d{2}$/.test(month)) return
    startFill(async () => {
      const r = await invoiceDraft(outletId, month, over ?? (picked && !fresh ? { beta, start: start || month } : undefined))
      setNote(r.note)
      if (!over && (!picked || fresh)) { setBeta(r.beta); setStart(r.start ?? '') }
      setAuto(r.auto)
      if (r.items.length) { setItems(r.items); setEdited(false) }
    })
  }
  const pick = (nextBeta: boolean, nextStart: string) => {
    setPicked(true); setBeta(nextBeta); setStart(nextStart)
    fill({ beta: nextBeta, start: nextStart || month })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPicked(false); if (!edited) fill(undefined, true) }, [outletId, month])
  const [preview, setPreview] = useState<{ text: string; error?: boolean }>({ text: '' })
  const [sending, startSend] = useTransition()
  const sendToMe = (form: HTMLFormElement) => {
    const data = new FormData(form)
    setPreview({ text: '' })
    startSend(async () => {
      const r = await sendInvoicePreview(data)
      setPreview(r.ok ? { text: `${r.to} 로 미리보기를 보냈습니다. ${r.note ?? ''}` } : { text: r.error ?? '보내지 못했습니다.', error: true })
    })
  }
  const set = (i: number, patch: Partial<InvoiceItem>) => { setEdited(true); setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x))) }

  return (
    <form action={action} className="space-y-5 rounded-2xl bg-white p-4 ring-1 sm:p-7 ring-black/5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="i-outlet" className="field-label">매체</label>
          <select id="i-outlet" name="outlet_id" required value={outletId} onChange={(e) => setOutletId(e.target.value)} className="field-input">
            <option value="" disabled>매체 선택</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="i-month" className="field-label">청구 월</label>
          <input id="i-month" name="month" type="month" required value={month} onChange={(e) => setMonth(e.target.value)} className="field-input" />
        </div>
        <div>
          <label htmlFor="i-due" className="field-label">납부 기한</label>
          <input id="i-due" name="due_date" type="date" defaultValue={new Date(Date.now() + 9 * 3600_000 + 14 * 864e5).toISOString().slice(0, 10)} className="field-input" />
          <p className="mt-1 text-[11.5px] text-muted">자동결제를 등록한 매체는 발행 7일 뒤부터, 납부 기한에 자동으로 결제됩니다.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line px-4 py-2.5 text-[13.5px]">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={beta} onChange={(e) => pick(e.target.checked, start || month)} disabled={!outletId} />
          베타 반값 (첫 청구 월부터 3개월)
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted">첫 청구 월</span>
          <input type="month" value={start} onChange={(e) => pick(beta, e.target.value)} disabled={!outletId || !beta} className="field-input w-40 py-1" />
        </label>
        <span className="text-[12px] text-muted">이번 청구서 계산에만 쓰입니다. 다음 달 자동 청구에도 반값을 이어 가려면 자동 청구 설정에 같은 값을 저장해 두세요.</span>
      </div>

      <input type="hidden" name="beta_on" value={beta ? 'on' : ''} />
      <input type="hidden" name="beta_start" value={start} />
      {outletId && !auto && (
        <label className="flex items-start gap-2 rounded-lg border border-[#2F6BF0]/40 bg-[#2F6BF0]/5 px-4 py-3 text-[13.5px] leading-relaxed">
          <input type="checkbox" name="enable_auto" checked={enableAuto} onChange={(e) => setEnableAuto(e.target.checked)} className="mt-1" />
          <span><strong>이 매체를 매달 자동 청구로 설정</strong> — 발행하면 다음 달부터 매월 1일에 이용료 청구서가 자동으로 발행되고(지난달 AI 추가 사용분 포함), 카드를 등록해 두면 자동으로 결제됩니다. 위의 베타 반값·첫 청구 월이 그대로 저장됩니다.</span>
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F4F6FA] px-4 py-2.5 text-[12.5px] text-muted">
        <span>{filling ? '요금표로 계산하는 중…' : note || (outletId ? '요금표와 이 매체의 자동 청구 설정(요금제·베타 반값·추가 매체·세팅비)으로 채웠습니다. 고쳐서 발행해도 됩니다.' : '매체를 고르면 요금표대로 항목이 채워집니다.')}</span>
        {outletId && <button type="button" onClick={() => fill()} disabled={filling} className="shrink-0 whitespace-nowrap font-semibold text-[#2F6BF0] disabled:opacity-50">요금표대로 다시 채우기</button>}
      </div>

      <div className="overflow-x-auto">
      <table className="table-cards w-full text-[14px] md:min-w-[560px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            <th className="py-2 font-medium">항목</th><th className="w-20 py-2 font-medium">수량</th><th className="w-36 py-2 font-medium">단가(원)</th><th className="w-32 py-2 text-right font-medium">금액</th><th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line/60 max-md:!px-0">
              <td className="tc-full py-2 pr-2"><input name="item_name" value={it.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="항목" className="field-input py-1.5" /></td>
              <td data-label="수량" className="w-20 py-2 pr-2 md:w-auto"><input name="item_qty" type="number" min={0} value={it.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} aria-label="수량" className="field-input py-1.5" /></td>
              <td data-label="단가(원)" className="w-36 py-2 pr-2 md:w-auto"><input name="item_price" type="number" min={0} step={100} value={it.unit_price} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} aria-label="단가" className="field-input py-1.5" /></td>
              <td data-label="금액" className="py-2 text-right tabular-nums">{won(it.qty * it.unit_price)}</td>
              <td className="ml-auto py-2 text-right"><button type="button" onClick={() => { setEdited(true); setItems(items.filter((_, j) => j !== i)) }} aria-label="줄 빼기" className="text-muted hover:text-danger">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button type="button" onClick={() => { setEdited(true); setItems([...items, { name: '', qty: 1, unit_price: 0 }]) }} className="text-[13px] font-semibold text-[#2F6BF0]">+ 항목 추가</button>

      <dl className="ml-auto w-full space-y-1 sm:w-64 text-[14px] tabular-nums">
        <div className="flex justify-between text-[16px] font-bold"><dt>합계</dt><dd>{won(t.total)}</dd></div>
        <p className="text-right text-[12px] text-muted">{TAX_NOTE}</p>
      </dl>

      <div>
        <label htmlFor="i-memo" className="field-label">안내 (입금 계좌 등)</label>
        <textarea id="i-memo" name="memo" rows={3} className="field-input" placeholder="예) 입금 계좌: ○○은행 000-0000-0000 (예금주 ○○○)" />
      </div>
      <p className="text-[12.5px] text-muted">같은 매체·같은 월 청구서가 이미 있으면 새 내용으로 바뀝니다.</p>
      {state.error && <p role="alert" className="text-[13.5px] text-danger">{state.error}</p>}
      {preview.text && <p role={preview.error ? 'alert' : 'status'} className={`text-right text-[13px] ${preview.error ? 'text-danger' : 'text-published'}`}>{preview.text}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={(e) => sendToMe(e.currentTarget.form!)} disabled={sending || !outletId} className="rounded-full border border-[#2F6BF0] bg-white px-6 py-2.5 text-[14.5px] font-bold text-[#2F6BF0] hover:bg-[#2F6BF0]/5 disabled:opacity-50">{sending ? '보내는 중…' : '나에게 보내기'}</button>
        <PendingButton pending="저장 중…" className="rounded-full bg-[#2F6BF0] px-8 py-2.5 text-[14.5px] font-bold text-white">청구서 발행</PendingButton>
      </div>
    </form>
  )
}
