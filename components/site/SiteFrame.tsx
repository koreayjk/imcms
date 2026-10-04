import type { CSSProperties, ReactNode } from 'react'
import { PRODUCT } from '@/lib/product'
import type { SiteConfig } from '@/lib/sites'
import { isDemo } from '@/lib/public-data'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import AdArea from './AdArea'

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
      {site.trial && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#1F3A5F] px-4 py-2 text-center text-[12.5px] text-white">
          <span><strong>IM 뉴스룸 체험용 신문</strong>입니다 — 기사는 샘플이거나 체험 중인 분이 쓴 연습 기사입니다.</span>
          <a href={`${PRODUCT.appLive ? PRODUCT.appUrl : 'https://imcms.vercel.app'}/trial`} className="rounded bg-white px-2.5 py-0.5 font-semibold text-[#1F3A5F] hover:bg-white/90">나도 1주일 무료 체험 →</a>
        </div>
      )}
      {site.preview && (
        <div className="flex items-center justify-center gap-3 bg-[#1C1F26] px-4 py-2 text-[12.5px] text-white">
          <span><strong>{site.name}</strong> 미리보기 — 도메인을 연결하기 전 화면입니다.</span>
          <a href="/?preview_outlet=clear" className="rounded bg-white/15 px-2 py-0.5 hover:bg-white/25">미리보기 끝내기</a>
        </div>
      )}
      <SiteHeader site={site} current={current} />
      <AdArea site={site} slot="header" className="mx-auto max-w-[1200px] px-4 pt-4" />
      <main id="content">{children}</main>
      <SiteFooter site={site} />
    </div>
  )
}
