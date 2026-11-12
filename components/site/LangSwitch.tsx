'use client'

import type { SiteConfig, ViewLang } from '@/lib/sites'

const LABEL: Record<ViewLang, string> = { en: 'English', ja: '日本語', zh: '中文' }

// "한글 | English | 日本語 | 中文" 버튼 (번역을 켠 매체만, 켠 언어만). 누르면 /lang 이 언어를 기억하고 보던 화면으로 돌아온다
export default function LangSwitch({ site, className = '', tone = 'dark' }: { site: SiteConfig; className?: string; tone?: 'dark' | 'light' }) {
  const langs = site.translate?.langs ?? []
  if (!langs.length) return null
  const cur = site.viewLang ?? 'ko'
  const go = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    window.location.href = `/lang?to=${to}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
  const on = tone === 'light' ? 'font-bold text-white' : 'font-bold text-brand'
  const off = tone === 'light' ? 'text-white/70 hover:text-white' : 'text-sub hover:text-brand'
  const items: { code: string; label: string }[] = [{ code: 'ko', label: '한글' }, ...langs.map((l) => ({ code: l, label: LABEL[l] }))]
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} role="group" aria-label="Language">
      {items.map((it, i) => (
        <span key={it.code} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden className={tone === 'light' ? 'text-white/40' : 'text-rule'}>|</span>}
          <a href={`/lang?to=${it.code}`} onClick={go(it.code)} lang={it.code} aria-current={cur === it.code ? 'true' : undefined} className={cur === it.code ? on : off}>{it.label}</a>
        </span>
      ))}
    </span>
  )
}
