'use client'

import { useFormState } from 'react-dom'
import { saveContactEmail, type SettingsState } from '@/app/(main)/admin/settings/actions'
import PendingButton from './PendingButton'

export default function ContactEmailForm({ email }: { email: string | null }) {
  const [state, action] = useFormState<SettingsState, FormData>(saveContactEmail, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label htmlFor="contact-email" className="sr-only">언론사 대표 이메일</label>
      <input id="contact-email" name="email" type="email" defaultValue={email ?? ''} placeholder="news@신문사도메인" maxLength={120} className="field-input max-w-xs" />
      <PendingButton pending="저장 중…" className="btn-primary">저장</PendingButton>
      {(state.error || state.ok) && <p role={state.error ? 'alert' : 'status'} className={`w-full text-[12.5px] ${state.error ? 'text-danger' : 'text-published'}`}>{state.error ?? state.ok}</p>}
    </form>
  )
}
