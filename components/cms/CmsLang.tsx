'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { makeT, type CmsLang, type T } from '@/lib/cms-i18n'

// 편집국 언어를 클라이언트 컴포넌트에 전해 주는 상자 (app/(main)/layout.tsx 에서 감싼다)
const Ctx = createContext<CmsLang>('ko')

export function CmsLangProvider({ lang, children }: { lang: CmsLang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>
}
export const useCmsLang = () => useContext(Ctx)
export function useT(): T {
  const lang = useContext(Ctx)
  return useMemo(() => makeT(lang), [lang])
}
