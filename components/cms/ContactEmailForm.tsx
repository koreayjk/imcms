'use client'

import { useActionState } from 'react'
import { saveContactEmail, type SettingsState } from '@/app/(main)/admin/settings/actions'
import { useT } from './CmsLang'
import PendingButton from './PendingButton'

export default function ContactEmailForm({ email }: { email: string | null }) {
  const t = useT()
  const [state, action] = useActionState<SettingsState, FormData>(saveContactEmail, {})
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label htmlFor="contact-email" className="sr-only">{t('언론사 대표 이메일', 'Outlet contact email')}</label>
      <input id="contact-email" name="email" type="email" defaultValue={email ?? ''} placeholder={t('news@신문사도메인', 'news@yourdomain.com')} maxLength={120} className="field-input max-w-xs" />
      <PendingButton pending={t('저장 중…', 'Saving…')} className="btn-primary">{t('저장', 'Save')}</PendingButton>
      {(state.error || state.ok) && <p role={state.error ? 'alert' : 'status'} className={`w-full text-[12.5px] ${state.error ? 'text-danger' : 'text-published'}`}>{state.error ?? state.ok}</p>}
    </form>
  )
}
