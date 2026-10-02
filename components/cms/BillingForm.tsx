'use client'

import { useFormState } from 'react-dom'
import { saveBilling, type FormState } from '@/app/(main)/support/actions'
import PendingButton from './PendingButton'

type Billing = Partial<Record<'company_name' | 'biz_no' | 'ceo_name' | 'address' | 'manager_name' | 'manager_email' | 'manager_phone', string | null>>

const FIELDS: { k: keyof Billing; label: string; ph?: string; type?: string; group: 'biz' | 'mgr' }[] = [
  { k: 'company_name', label: '상호(법인명)', group: 'biz' },
  { k: 'biz_no', label: '사업자등록번호', ph: '000-00-00000', group: 'biz' },
  { k: 'ceo_name', label: '대표자', group: 'biz' },
  { k: 'address', label: '사업장 주소', group: 'biz' },
  { k: 'manager_name', label: '담당자 이름', group: 'mgr' },
  { k: 'manager_email', label: '담당자 이메일', type: 'email', ph: '청구서·영수증을 받을 주소', group: 'mgr' },
  { k: 'manager_phone', label: '담당자 연락처', type: 'tel', group: 'mgr' },
]

export default function BillingForm({ outletId, billing }: { outletId: string; billing: Billing | null }) {
  const [state, action] = useFormState<FormState, FormData>(saveBilling.bind(null, outletId), {})
  const section = (group: 'biz' | 'mgr', title: string) => (
    <fieldset className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
      <legend className="px-1 text-[15px] font-bold">{title}</legend>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {FIELDS.filter((f) => f.group === group).map((f) => (
          <div key={f.k} className={f.k === 'address' ? 'sm:col-span-2' : ''}>
            <label htmlFor={f.k} className="field-label">{f.label}</label>
            <input id={f.k} name={f.k} type={f.type ?? 'text'} defaultValue={billing?.[f.k] ?? ''} placeholder={f.ph} className="field-input" />
          </div>
        ))}
      </div>
    </fieldset>
  )
  return (
    <form action={action} className="space-y-5">
      {section('mgr', '청구서·결제 담당자')}
      {section('biz', '사업자 정보 (청구서 표기용)')}
      <div className="flex items-center justify-end gap-3">
        {state.error && <p role="alert" className="text-[13.5px] text-danger">{state.error}</p>}
        {state.ok && <p role="status" className="text-[13.5px] text-published">저장했습니다.</p>}
        <PendingButton pending="저장 중…" className="rounded-full bg-[#2F6BF0] px-8 py-2.5 text-[14.5px] font-bold text-white">저장</PendingButton>
      </div>
    </form>
  )
}
