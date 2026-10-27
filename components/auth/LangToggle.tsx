'use client'

import { useRouter } from 'next/navigation'
import { useCmsLang } from '@/components/cms/CmsLang'
import type { CmsLang } from '@/lib/cms-i18n'

// 쿠키 이름은 lib/cms-t-public.ts 의 LANG_COOKIE 와 같아야 한다 (그 파일은 서버 전용이라 여기서 가져올 수 없다)
const COOKIE = 'im_lang'

// 로그인 전 화면 위의 "English | 한국어" 단추: 고른 언어를 쿠키(1년)에 적고 화면을 새로 읽는다
export default function LangToggle({ className = '' }: { className?: string }) {
  const lang = useCmsLang()
  const router = useRouter()
  function pick(next: CmsLang) {
    if (next === lang) return
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    router.refresh()
  }
  const btn = (code: CmsLang, label: string) => (
    <button
      type="button"
      onClick={() => pick(code)}
      lang={code}
      aria-pressed={lang === code}
      className={`rounded px-1.5 py-0.5 hover:text-ink ${lang === code ? 'font-semibold text-ink' : ''}`}
    >
      {label}
    </button>
  )
  return (
    <div className={`flex items-center justify-end gap-0.5 text-[12.5px] text-muted ${className}`}>
      {btn('en', 'English')}
      <span aria-hidden className="text-line">|</span>
      {btn('ko', '한국어')}
    </div>
  )
}
