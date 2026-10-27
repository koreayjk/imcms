'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setMyLang } from '@/app/(main)/account/actions'
import { useT } from './CmsLang'

// 내 정보: 편집국 언어 고르기 (비워 두면 매체 기본 언어)
export default function LanguageForm({ value, outletDefault }: { value: 'ko' | 'en' | null; outletDefault: 'ko' | 'en' }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  return (
    <div className="space-y-2">
      <label htmlFor="cms-lang" className="text-[13px] font-semibold">{t('편집국 언어', 'Newsroom language')}</label>
      <div>
        <select
          id="cms-lang"
          value={value ?? 'default'}
          disabled={pending}
          onChange={(e) => start(async () => {
            const r = await setMyLang(e.target.value as 'default' | 'ko' | 'en')
            setError(r.error ?? '')
            if (!r.error) router.refresh()
          })}
          className="field-input max-w-xs"
        >
          <option value="default">{t(`매체 기본 (${outletDefault === 'en' ? 'English' : '한국어'})`, `Outlet default (${outletDefault === 'en' ? 'English' : '한국어'})`)}</option>
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </div>
      <p role={error ? 'alert' : 'status'} className={`text-[12.5px] ${error ? 'text-danger' : 'text-muted'}`}>
        {error || t('메뉴와 안내 문구가 이 언어로 보입니다. 다른 사람에게는 영향이 없습니다.', 'Menus and messages appear in this language. It does not affect anyone else.')}
      </p>
    </div>
  )
}
