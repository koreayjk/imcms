'use client'

import type { ReactNode } from 'react'
import BrandMark from '@/components/BrandMark'
import { CmsLangProvider, useCmsLang, useT } from '@/components/cms/CmsLang'
import type { CmsLang } from '@/lib/cms-i18n'
import LangToggle from './LangToggle'

// 로그인 전 화면 틀. 언어는 lang 으로 받거나(없으면 감싼 CmsLangProvider 의 값) 쓰고, 안의 자식들에게도 전해 준다
export default function AuthShell({ subtitle, children, footer, lang }: { subtitle: string; children: ReactNode; footer?: ReactNode; lang?: CmsLang }) {
  const inherited = useCmsLang()
  return (
    <CmsLangProvider lang={lang ?? inherited}>
      <Shell subtitle={subtitle} footer={footer}>{children}</Shell>
    </CmsLangProvider>
  )
}

function Shell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  const t = useT()
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper py-12">
      <div className="w-full max-w-sm px-4">
        <LangToggle className="mb-6" />
        <div className="mb-10 text-center">
          <h1 className="flex flex-col items-center gap-3 text-xl font-semibold tracking-tight"><BrandMark size={56} className="rounded-xl" />{t('IM 뉴스룸 편집국', 'IM Newsroom')}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
        {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        <PolicyLinks className="mt-10 justify-center" />
      </div>
    </div>
  )
}

export function OrDivider() {
  const t = useT()
  return (
    <div className="ios-app-hide my-6 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      {t('또는', 'or')}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

// 이용약관·개인정보처리방침·계정 삭제 안내 (앱 안에서도 보여야 한다: 구글 플레이 정책)
export function PolicyLinks({ className = '' }: { className?: string }) {
  const t = useT()
  return (
    <nav aria-label={t('약관과 방침', 'Terms and policies')} className={`flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted ${className}`}>
      <a href="/imnewsroom/terms" className="hover:text-ink hover:underline">{t('이용약관', 'Terms of Service')}</a>
      <a href="/imnewsroom/privacy" className="font-semibold hover:text-ink hover:underline">{t('개인정보처리방침', 'Privacy Policy')}</a>
      <a href="/imnewsroom/account-deletion" className="hover:text-ink hover:underline">{t('계정 삭제 안내', 'Account deletion')}</a>
    </nav>
  )
}
