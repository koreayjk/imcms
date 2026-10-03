'use client'

import { useState } from 'react'
import { useFormState } from 'react-dom'
import { saveInvoice, type FormState } from '@/app/(main)/support/actions'
import { invoiceTotals, won, type InvoiceItem } from '@/lib/support'
import PendingButton from './PendingButton'

export default function InvoiceForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const [state, action] = useFormState<FormState, FormData>(saveInvoice, {})
  const [items, setItems] = useState<InvoiceItem[]>([{ name: 'IM 뉴스룸 이용료', qty: 1, unit_price: 0 }])
  const t = invoiceTotals(items)
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const set = (i: number, patch: Partial<InvoiceItem>) => setItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  return (
    <form action={action} className="space-y-5 rounded-2xl bg-white p-7 ring-1 ring-black/5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="i-outlet" className="field-label">매체</label>
          <select id="i-outlet" name="outlet_id" required defaultValue="" className="field-input">
            <option value="" disabled>매체 선택</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="i-month" className="field-label">청구 월</label>
          <input id="i-month" name="month" type="month" required defaultValue={month} className="field-input" />
        </div>
        <div>
          <label htmlFor="i-due" className="field-label">납부 기한</label>
          <input id="i-due" name="due_date" type="date" defaultValue={new Date(Date.now() + 9 * 3600_000 + 14 * 864e5).toISOString().slice(0, 10)} className="field-input" />
          <p className="mt-1 text-[11.5px] text-muted">자동결제를 등록한 매체는 발행 7일 뒤부터, 납부 기한에 자동으로 결제됩니다.</p>
        </div>
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
              <td className="py-2 text-right"><button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="줄 빼기" className="text-muted hover:text-danger">×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button type="button" onClick={() => setItems([...items, { name: '', qty: 1, unit_price: 0 }])} className="text-[13px] font-semibold text-[#2F6BF0]">+ 항목 추가</button>

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
