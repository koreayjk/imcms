'use client'

import { siteText } from '@/lib/site-text'
import type { SiteLang } from '@/lib/sites'

export default function ShareButton({ title, lang }: { title: string; lang?: SiteLang }) {
  const t = siteText(lang)
  function share() {
    if (navigator.share) {
      navigator.share({ title, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {
        alert(t.copied)
      }).catch(() => {})
    }
  }

  return (
    <button
      onClick={share}
      type="button"
      className="rounded-full border border-rule px-3.5 py-1.5 text-[12.5px] text-sub transition-colors hover:border-brand hover:text-brand"
    >
      {t.share}
    </button>
  )
}
