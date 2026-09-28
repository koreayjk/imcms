import type { CSSProperties, ReactNode } from 'react'
import type { SiteConfig } from '@/lib/sites'
import { isDemo } from '@/lib/public-data'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'

type Props = { site: SiteConfig; current?: string; children: ReactNode }

export default function SiteFrame({ site, current, children }: Props) {
  const vars = {
    '--brand': site.colors.brand,
    '--brand-dark': site.colors.brandDark,
    '--gold': site.colors.gold,
    '--gold-ink': site.colors.goldInk,
  } as CSSProperties

  return (
    <div className="site min-h-screen" style={vars}>
      {isDemo && (
        <div className="bg-gold px-4 py-1.5 text-center text-[12px] font-semibold text-brand-dark">
          미리보기 화면입니다 — 표시된 기사는 레이아웃 확인용 샘플이며 실제 기사가 아닙니다.
        </div>
      )}
      <SiteHeader site={site} current={current} />
      <main id="content">{children}</main>
      <SiteFooter site={site} />
    </div>
  )
}
