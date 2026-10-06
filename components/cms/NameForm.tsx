'use client'

import { useActionState } from 'react'
import { updateMyName, type NameState } from '@/app/(main)/account/actions'
import PendingButton from './PendingButton'

export default function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState<NameState, FormData>(updateMyName, {})
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="full_name" className="text-[13px] font-semibold">이름</label>
      <div className="flex gap-2">
        <input id="full_name" name="full_name" defaultValue={name} required maxLength={30} className="field-input max-w-xs" autoComplete="name" />
        <PendingButton pending="저장 중…" className="btn-primary">저장</PendingButton>
      </div>
      <p role={state.error ? 'alert' : 'status'} className={`text-[12.5px] ${state.error ? 'text-danger' : state.ok ? 'text-published' : 'text-muted'}`}>
        {state.error ?? (state.ok ? '이름을 바꿨습니다.' : '기사 기자명과 홈페이지 기자 이름에 쓰입니다.')}
      </p>
    </form>
  )
}
