import type { CSSProperties, ReactNode } from 'react'
import { PRODUCT } from '@/lib/product'
import type { SiteConfig } from '@/lib/sites'
import { isDemo } from '@/lib/public-data'
import SiteHeader from './SiteHeader'
import SiteFooter from './SiteFooter'
import AdArea from './AdArea'
import { siteText } from '@/lib/site-text'
import { HOME_LAYOUTS } from '@/lib/home-layouts'
import { LAYOUTS_EN } from '@/lib/home-layouts-en'

type Props = { site: SiteConfig; current?: string; children: ReactNode }

export default function SiteFrame({ site, current, children }: Props) {
  const vars = {
    '--brand': site.colors.brand,
    '--brand-dark': site.colors.brandDark,
    '--gold': site.colors.gold,
    '--gold-ink': site.colors.goldInk,
  } as CSSProperties

  const t = siteText(site)
  const en = site.lang === 'en'
  return (
    <div className="site min-h-screen" data-layout={site.homeLayout ?? 'standard'} style={en ? { ...vars, fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif" } : vars} lang={t.htmlLang} data-lang={t.htmlLang}>
      {/* 영문 매체: 문서 언어를 영어로 (루트 html 은 편집국과 같이 쓰므로 여기서 바꾼다), 미국 신문 느낌의 세리프 글꼴 */}
      {en && (
        <>
          <script dangerouslySetInnerHTML={{ __html: "document.documentElement.lang='en'" }} />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700;8..60,800&display=swap" />
        </>
      )}
      {site.homeLayout === 'editorial' && !en && (
        // 미국 스타일 1: 제목용 명조(세리프) 글꼴
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;700;900&display=swap" />
      )}
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
          <span><strong>{site.name}</strong> {t.previewText}</span>
          <a href="/?preview_outlet=clear" className="rounded bg-white/15 px-2 py-0.5 hover:bg-white/25">{t.previewEnd}</a>
        </div>
      )}
      {(site.preview || isDemo || site.layoutDemo) && (
        // 미리보기: 홈 배치 5가지를 눌러 바꿔 가며 볼 수 있다 (고른 배치는 기사·섹션 화면에서도 유지된다)
        <nav aria-label={en ? 'Try the homepage layouts' : '홈페이지 배치 바꿔 보기'} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 border-b border-rule bg-[#F3F5F8] px-3 py-2 text-[12.5px]">
          <span className="font-semibold text-sub">{en ? 'Homepage layout' : '홈페이지 배치'}</span>
          {HOME_LAYOUTS.filter((l) => l.ready).map((l) => {
            const on = (site.homeLayout ?? 'standard') === l.key
            const href = site.preview && site.outletId ? `/?preview_outlet=${site.outletId}&layout=${l.key}` : `/?layout=${l.key}`
            return (
              <a key={l.key} href={href} aria-current={on ? 'true' : undefined} className={`rounded-full px-3 py-1 ${on ? 'bg-[#1F3A5F] font-bold text-white' : 'border border-[#CBD1DB] bg-white text-body hover:border-[#1F3A5F]'}`}>
                {en ? LAYOUTS_EN.find((x) => x.key === l.key)?.name : l.name}<span className="hidden sm:inline"> · {en ? LAYOUTS_EN.find((x) => x.key === l.key)?.label : l.label}</span>
              </a>
            )
          })}
        </nav>
      )}
      <SiteHeader site={site} current={current} />
      <AdArea site={site} slot="header" className="mx-auto max-w-[1200px] px-4 pt-4" />
      <main id="content">{children}</main>
      <SiteFooter site={site} />
    </div>
  )
}
