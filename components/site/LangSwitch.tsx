'use client'

import type { SiteConfig } from '@/lib/sites'

// "한글 | English" 버튼 (번역을 켠 매체만). 누르면 /lang 이 언어를 기억하고 보던 화면으로 돌아온다
export default function LangSwitch({ site, className = '', tone = 'dark' }: { site: SiteConfig; className?: string; tone?: 'dark' | 'light' }) {
  if (!site.translate?.langs.includes('en')) return null
  const en = site.viewLang === 'en'
  const go = (to: 'ko' | 'en') => (e: React.MouseEvent) => {
    e.preventDefault()
    window.location.href = `/lang?to=${to}&next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }
  const on = tone === 'light' ? 'font-bold text-white' : 'font-bold text-brand'
  const off = tone === 'light' ? 'text-white/70 hover:text-white' : 'text-sub hover:text-brand'
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} role="group" aria-label="Language">
      <a href="/lang?to=ko" onClick={go('ko')} lang="ko" aria-current={!en ? 'true' : undefined} className={!en ? on : off}>한글</a>
      <span aria-hidden className={tone === 'light' ? 'text-white/40' : 'text-rule'}>|</span>
      <a href="/lang?to=en" onClick={go('en')} lang="en" aria-current={en ? 'true' : undefined} className={en ? on : off}>English</a>
    </span>
  )
}
