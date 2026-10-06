'use client'

import { useEffect, useState, useTransition, useActionState } from 'react'
import { invoiceDraft, saveInvoice, type FormState } from '@/app/(main)/support/actions'
import { invoiceTotals, won, type InvoiceItem } from '@/lib/support'
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
  const fill = () => {
    if (!outletId || !/^\d{4}-\d{2}$/.test(month)) return
    startFill(async () => {
      const r = await invoiceDraft(outletId, month)
      setNote(r.note)
      if (r.items.length) { setItems(r.items); setEdited(false) }
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!edited) fill() }, [outletId, month])
  const set = (i: number, patch: Partial<InvoiceItem>) => { setEdited(true); setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x))) }

  return (
    <form action={action} className="space-y-5 rounded-2xl bg-white p-7 ring-1 ring-black/5">
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F4F6FA] px-4 py-2.5 text-[12.5px] text-muted">
        <span>{filling ? '요금표로 계산하는 중…' : note || (outletId ? '요금표와 이 매체의 자동 청구 설정(요금제·베타 반값·추가 매체·세팅비)으로 채웠습니다. 고쳐서 발행해도 됩니다.' : '매체를 고르면 요금표대로 항목이 채워집니다.')}</span>
        {outletId && <button type="button" onClick={fill} disabled={filling} className="font-semibold text-[#2F6BF0] disabled:opacity-50">요금표대로 다시 채우기</button>}
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[14px]">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            <th className="py-2 font-medium">항목</th><th className="w-20 py-2 font-medium">수량</th><th className="w-36 py-2 font-medium">단가(원, VAT 포함)</th><th className="w-32 py-2 text-right font-medium">금액</th><th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-line/60">
              <td className="py-2 pr-2"><input name="item_name" value={it.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="항목" className="field-input py-1.5" /></td>
              <td className="py-2 pr-2"><input name="item_qty" type="number" min={0} value={it.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} aria-label="수량" className="field-input py-1.5" /></td>
              <td className="py-2 pr-2"><input name="item_price" type="number" min={0} step={100} value={it.unit_price} onChange={(e) => set(i, { unit_price: Number(e.target.value) })} aria-label="단가" className="field-input py-1.5" /></td>
              <td className="py-2 text-right tabular-nums">{won(it.qty * it.unit_price)}</td>
              <td className="py-2 text-right"><button type="button" onClick={() => { setEdited(true); setItems(items.filter((_, j) => j !== i)) }} aria-label="줄 빼기" className="text-muted hover:text-danger">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button type="button" onClick={() => { setEdited(true); setItems([...items, { name: '', qty: 1, unit_price: 0 }]) }} className="text-[13px] font-semibold text-[#2F6BF0]">+ 항목 추가</button>

      <dl className="ml-auto w-64 space-y-1 text-[14px] tabular-nums">
        <div className="flex justify-between text-[16px] font-bold"><dt>합계 (VAT 포함)</dt><dd>{won(t.total)}</dd></div>
        <div className="flex justify-between border-t border-line pt-1 text-[12.5px] text-muted"><dt>공급가액</dt><dd>{won(t.supply)}</dd></div>
        <div className="flex justify-between text-[12.5px] text-muted"><dt>부가세</dt><dd>{won(t.vat)}</dd></div>
      </dl>

      <div>
        <label htmlFor="i-memo" className="field-label">안내 (입금 계좌 등)</label>
        <textarea id="i-memo" name="memo" rows={3} className="field-input" placeholder="예) 입금 계좌: ○○은행 000-0000-0000 (예금주 ○○○)" />
      </div>
      <p className="text-[12.5px] text-muted">같은 매체·같은 월 청구서가 이미 있으면 새 내용으로 바뀝니다.</p>
      {state.error && <p role="alert" className="text-[13.5px] text-danger">{state.error}</p>}
      <div className="flex justify-end"><PendingButton pending="저장 중…" className="rounded-full bg-[#2F6BF0] px-8 py-2.5 text-[14.5px] font-bold text-white">청구서 발행</PendingButton></div>
    </form>
  )
}
