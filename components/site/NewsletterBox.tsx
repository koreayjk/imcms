'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { subscribeNewsletter, type SubscribeState } from '@/app/newsletter/actions'
import { siteText } from '@/lib/site-text'
import type { SiteLang } from '@/lib/sites'

function Submit({ lang }: { lang?: SiteLang }) {
  const { pending } = useFormStatus()
  const t = siteText(lang)
  return <button type="submit" disabled={pending} className="shrink-0 bg-brand px-4 py-2.5 text-[14px] font-bold text-white hover:opacity-90 disabled:opacity-60">{pending ? t.nlSubmitting : t.nlSubmit}</button>
}

// 홈페이지 하단 뉴스레터 구독 (확인 메일의 링크를 눌러야 구독이 시작된다)
export default function NewsletterBox({ siteName, lang }: { siteName: string; lang?: SiteLang }) {
  const t = siteText(lang)
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeNewsletter, {})
  if (state.ok) {
    return <p role="status" className="text-[14px] text-body">{t.nlSent(siteName)}</p>
  }
  return (
    <form action={action} className="space-y-2">
      <p className="text-[15px] font-bold text-body">{t.nlTitle(siteName)}</p>
      <p className="text-[13px] text-sub">{t.nlSub}</p>
      <div className="flex max-w-[460px]">
        <label htmlFor="nl-email" className="sr-only">{t.nlEmail}</label>
        <input id="nl-email" name="email" type="email" required autoComplete="email" placeholder={t.nlPlaceholder} className="min-w-0 flex-1 border border-rule bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand" />
        <Submit lang={lang} />
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><input name="website" tabIndex={-1} autoComplete="off" /></div>
      <label className="flex items-start gap-2 text-[12px] text-sub">
        <input type="checkbox" name="agree" required className="mt-0.5" />
        <span>{t.nlAgree}</span>
      </label>
      {state.error && <p role="alert" className="text-[13px] font-semibold text-[#C0392B]">{state.error}</p>}
    </form>
  )
}
