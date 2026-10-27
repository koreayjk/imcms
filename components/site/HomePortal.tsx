import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PublicArticle } from '@/lib/public-data'
import type { SectionConfig, SiteConfig } from '@/lib/sites'
import { formatShort } from '@/lib/format'
import { siteText } from '@/lib/site-text'
import SectionHeading from './SectionHeading'
import MostViewed from './MostViewed'
import Thumb from './Thumb'
import { CategoryLabel, TitleList } from './items'

// 홈 배치 '한국 스타일 2 · 포털 목록형' (homeLayout = 'portal')
//   속보 띠 → 큰 톱 1건(사진 위 제목) + 오른쪽 제목 목록 → 주요뉴스 목록 · 섹션 박스 · 오른쪽 많이 본 뉴스
//   사진은 작게, 제목을 많이 보여 준다 (기사가 많은 매체용)

type Props = {
  site: SiteConfig
  headline: PublicArticle
  subTops: PublicArticle[]
  underHeadline: PublicArticle[]
  breaking: PublicArticle[]
  major: PublicArticle[]
  picks: PublicArticle[]
  mostViewed: PublicArticle[]
  bySection: Record<string, PublicArticle[]>
  sections: SectionConfig[]
  middleAd?: ReactNode
  sideExtras?: ReactNode
}

export default function HomePortal({ site, headline, subTops, underHeadline, breaking, major, picks, mostViewed, bySection, sections, middleAd, sideExtras }: Props) {
  const L = site.lang
  const t = siteText(site)
  const boxes = sections.filter((s) => (bySection[s.slug] ?? []).length > 0).slice(0, 8)

  return (
    <>
      {/* ── 속보 띠 ── */}
      {breaking.length > 0 && (
        <div className="border-b border-rule bg-soft">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2 text-[13.5px]">
            <span className="flex-shrink-0 rounded bg-[#D6402B] px-2 py-0.5 text-[11.5px] font-bold text-white">{L === 'en' ? 'LATEST' : '속보'}</span>
            <ul className="no-scrollbar flex min-w-0 flex-1 gap-7 overflow-x-auto whitespace-nowrap">
              {breaking.map((a) => (
                <li key={a.id} className="flex-shrink-0">
                  <Link href={`/news/${a.id}`} className="hover:underline underline-offset-2">
                    <time dateTime={a.published_at ?? undefined} className="mr-1.5 text-[12px] font-semibold tabular-nums text-brand">{formatShort(a.published_at, L, site.timeZone)}</time>
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1200px] px-4">
        {/* ── 톱: 큰 사진 + 오른쪽 제목 목록 ── */}
        <section aria-label={t.topStories} className="grid grid-cols-1 gap-6 border-b border-rule py-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-8 lg:py-7">
          <Link href={`/news/${headline.id}`} className="headline-link group relative block overflow-hidden">
            <Thumb sizes="(max-width: 1023px) 100vw, 720px" src={headline.thumbnail_url} alt={headline.title} ratio="16 / 10" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-4 pt-16 text-white sm:px-6 sm:pb-6">
              {headline.category && <span className="block text-[12px] font-semibold text-white/85">{headline.category.name}</span>}
              <h2 className="mt-1 line-clamp-2 text-balance text-[22px] font-extrabold leading-[1.32] tracking-[-0.03em] sm:text-[30px]">{headline.title}</h2>
              {headline.excerpt && <p className="mt-2 hidden line-clamp-1 text-[14.5px] text-white/85 sm:block">{headline.excerpt}</p>}
            </div>
          </Link>

          <div className="min-w-0">
            <ul className="divide-y divide-rule">
              {subTops.slice(0, 2).map((a) => (
                <li key={a.id} className="py-3.5 first:pt-0">
                  <Link href={`/news/${a.id}`} className="headline-link group flex gap-3.5">
                    <Thumb sizes="120px" src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[112px] flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <CategoryLabel article={a} />
                      <h3 className="headline-text mt-0.5 line-clamp-3 text-[16.5px] font-bold leading-[1.42] tracking-[-0.02em]">{a.title}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="mt-1 divide-y divide-rule border-t border-rule">
              {underHeadline.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="group flex items-baseline gap-2.5 py-2.5">
                    <span className="h-1 w-1 flex-shrink-0 translate-y-[-2px] rounded-full bg-gold" aria-hidden />
                    <span className="line-clamp-1 flex-1 text-[15px] leading-[1.45] group-hover:underline underline-offset-2">{a.title}</span>
                    <time dateTime={a.published_at ?? undefined} className="flex-shrink-0 text-[12px] tabular-nums text-[#8A918C]">{formatShort(a.published_at, L, site.timeZone)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── 이슈 PICK (편집판에서 채운 경우만) ── */}
        {picks.length > 0 && (
          <section aria-labelledby="pick-title" className="border-b border-rule py-5">
            <h2 id="pick-title" className="mb-3 text-[16px] font-bold tracking-[-0.02em] text-gold-ink">{t.pick}</h2>
            <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {picks.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="headline-link group block border-l-2 border-rule pl-3 hover:border-gold">
                    <CategoryLabel article={a} />
                    <p className="headline-text mt-0.5 line-clamp-2 text-[14.5px] font-semibold leading-[1.45]">{a.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {middleAd}

        {/* ── 주요뉴스 + 섹션 박스 + 오른쪽 많이 본 뉴스 ── */}
        <div className="grid grid-cols-1 gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-10">
            {major.length > 0 && (
              <section id="major" className="scroll-mt-28">
                <SectionHeading title={t.majorShort} lang={L} />
                <ul className="grid gap-x-7 sm:grid-cols-2">
                  {major.slice(0, 8).map((a) => (
                    <li key={a.id} className="border-b border-rule py-3.5">
                      <Link href={`/news/${a.id}`} className="headline-link group flex gap-3.5">
                        <Thumb sizes="120px" src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[104px] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="headline-text line-clamp-2 text-[15.5px] font-bold leading-[1.42] tracking-[-0.02em]">{a.title}</h3>
                          <time dateTime={a.published_at ?? undefined} className="mt-1 block text-[12px] tabular-nums text-[#8A918C]">{formatShort(a.published_at, L, site.timeZone)}</time>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="grid gap-x-7 gap-y-9 sm:grid-cols-2">
              {boxes.map((s) => {
                const [lead, ...rest] = bySection[s.slug] ?? []
                return (
                  <section key={s.slug} className="min-w-0">
                    <SectionHeading title={s.name} href={`/section/${s.slug}`} lang={L} />
                    <Link href={`/news/${lead.id}`} className="headline-link group flex gap-3.5">
                      <Thumb sizes="140px" src={lead.thumbnail_url} alt="" ratio="4 / 3" className="w-[124px] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="headline-text line-clamp-3 text-[16px] font-bold leading-[1.42] tracking-[-0.02em]">{lead.title}</h3>
                        {lead.excerpt && <p className="mt-1 line-clamp-2 text-[13px] leading-[1.55] text-sub">{lead.excerpt}</p>}
                      </div>
                    </Link>
                    <TitleList items={rest.slice(0, 4)} className="mt-4 border-t border-rule pt-4" />
                  </section>
                )
              })}
            </div>
          </div>

          <aside className="space-y-9">
            <MostViewed items={mostViewed} lang={L} />
            {sideExtras}
          </aside>
        </div>
      </div>
    </>
  )
}
