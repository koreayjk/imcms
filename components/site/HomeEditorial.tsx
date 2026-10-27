import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PublicArticle } from '@/lib/public-data'
import type { SectionConfig, SiteConfig } from '@/lib/sites'
import { formatDate, formatShort } from '@/lib/format'
import { siteText } from '@/lib/site-text'
import Thumb from './Thumb'

// 홈 배치 '미국 스타일 1 · 에디토리얼' (homeLayout = 'editorial')
//   머리말은 가운데 큰 제호 + 가로 메뉴(SiteHeader). 제목은 명조(세리프), 가는 선으로 칸을 나눈다
//   3단: 왼쪽 글 목록 · 가운데 큰 톱 · 오른쪽 많이 본 기사/실시간 → 주요 기사 4칸 → 섹션별 3열

type Props = {
  site: SiteConfig
  headline: PublicArticle
  subTops: PublicArticle[]
  underHeadline: PublicArticle[]
  realtime: PublicArticle[]
  major: PublicArticle[]
  picks: PublicArticle[]
  mostViewed: PublicArticle[]
  bySection: Record<string, PublicArticle[]>
  sections: SectionConfig[]
  middleAd?: ReactNode
  sideExtras?: ReactNode
}

const kicker = 'text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-ink'

function Kicker({ a }: { a: PublicArticle }) {
  return a.category ? <span className={`block ${kicker}`}>{a.category.name}</span> : null
}

export default function HomeEditorial({ site, headline, subTops, underHeadline, realtime, major, picks, mostViewed, bySection, sections, middleAd, sideExtras }: Props) {
  const L = site.lang
  const t = siteText(site)
  const leftItems = subTops.slice(0, 2)
  const boxes = sections.filter((s) => (bySection[s.slug] ?? []).length > 0).slice(0, 6)

  return (
    <div className="mx-auto max-w-[1200px] px-4">
      {/* ── 3단 톱 ── */}
      <section aria-label={t.topStories} className="grid grid-cols-1 gap-8 py-7 lg:grid-cols-[250px_minmax(0,1fr)_280px] lg:gap-0">
        {/* 가운데: 큰 톱 */}
        <div className="order-first min-w-0 lg:order-none lg:border-x lg:border-rule lg:px-7">
        <Link href={`/news/${headline.id}`} className="headline-link group block">
          <Thumb sizes="(max-width: 1023px) 100vw, 640px" src={headline.thumbnail_url} alt={headline.title} ratio="3 / 2" />
          <div className="mt-4">
            <Kicker a={headline} />
            <h2 className="headline-text mt-1 text-balance text-[27px] font-extrabold leading-[1.28] tracking-[-0.02em] lg:text-[34px]">{headline.title}</h2>
            {headline.excerpt && <p className="mt-3 line-clamp-3 text-[16px] leading-[1.65] text-sub">{headline.excerpt}</p>}
            <p className="mt-3 text-[12.5px] text-[#8A918C]">{headline.author_name ? `${headline.author_name} · ` : ''}{formatDate(headline.published_at, L, site.timeZone)}</p>
          </div>
        </Link>
        {underHeadline.length > 0 && (
          <ul className="mt-6 grid grid-cols-1 gap-x-6 border-t border-rule sm:grid-cols-2">
            {underHeadline.slice(0, 4).map((a) => (
              <li key={a.id} className="border-b border-rule py-3.5">
                <Link href={`/news/${a.id}`} className="headline-link group flex gap-3">
                  {a.thumbnail_url && <Thumb sizes="100px" src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[84px] flex-shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <Kicker a={a} />
                    <p className="headline-text mt-0.5 line-clamp-3 text-[15px] font-bold leading-[1.42]">{a.title}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        </div>

        {/* 왼쪽: 글 목록 + 실시간 */}
        <div className="lg:order-first lg:pr-7">
        <ul className="divide-y divide-rule">
          {leftItems.map((a) => (
            <li key={a.id}>
              <Link href={`/news/${a.id}`} className="headline-link group block py-4 first:pt-0 lg:py-4">
                <Kicker a={a} />
                <h3 className="headline-text mt-1 line-clamp-3 text-[18px] font-bold leading-[1.38] tracking-[-0.015em]">{a.title}</h3>
                {a.excerpt && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-sub">{a.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
          <section aria-label={t.realtime} className="mt-2 border-t border-rule pt-5">
            <h3 className={`border-b-2 border-body pb-1.5 ${kicker} !text-body`}>{t.realtime}</h3>
            <ul className="divide-y divide-rule">
              {realtime.slice(0, 3).map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="group block py-2.5">
                    <time dateTime={a.published_at ?? undefined} className="text-[11.5px] font-semibold tabular-nums text-brand">{formatShort(a.published_at, L, site.timeZone)}</time>
                    <p className="line-clamp-2 text-[14px] leading-[1.45] group-hover:underline underline-offset-2">{a.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* 오른쪽: 많이 본 기사 */}
        <aside className="space-y-8 lg:pl-7">
          <section aria-label={t.popular}>
            <h3 className={`border-b-2 border-body pb-1.5 ${kicker} !text-body`}>{t.popular}</h3>
            <ol className="divide-y divide-rule">
              {mostViewed.slice(0, 5).map((a, i) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="group flex gap-3 py-3">
                    <span className="w-6 flex-shrink-0 font-serif text-[26px] font-bold italic leading-none text-gold">{i + 1}</span>
                    <span className="line-clamp-3 text-[14.5px] leading-[1.45] group-hover:underline underline-offset-2">{a.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
          {sideExtras}
        </aside>
      </section>

      {picks.length > 0 && (
        <section aria-labelledby="pick-title" className="border-t border-rule py-5">
          <h2 id="pick-title" className={`mb-3 ${kicker}`}>{t.pick}</h2>
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {picks.map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="headline-link group block border-l-2 border-rule pl-3 hover:border-gold">
                  <p className="headline-text line-clamp-2 text-[15.5px] font-bold leading-[1.42]">{a.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {middleAd}

      {/* ── 주요 기사 4칸 ── */}
      {major.length > 0 && (
        <section id="major" className="scroll-mt-28 border-t-[3px] border-double border-body py-6">
          <h2 className={`mb-4 ${kicker} !text-body`}>{t.majorShort}</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-7 lg:grid-cols-4">
            {major.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="headline-link group block">
                  <Thumb sizes="(max-width: 1023px) 50vw, 280px" src={a.thumbnail_url} alt="" ratio="3 / 2" />
                  <Kicker a={a} />
                  <h3 className="headline-text mt-1 line-clamp-3 text-[17px] font-bold leading-[1.4] tracking-[-0.015em]">{a.title}</h3>
                  <time dateTime={a.published_at ?? undefined} className="mt-1.5 block text-[12px] text-[#8A918C]">{formatDate(a.published_at, L, site.timeZone)}</time>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 섹션별 3열 ── */}
      <div className="grid gap-x-0 gap-y-10 border-t border-rule py-8 sm:grid-cols-2 lg:grid-cols-3">
        {boxes.map((s, i) => {
          const [lead, ...rest] = bySection[s.slug] ?? []
          return (
            <section key={s.slug} className={`min-w-0 sm:px-6 ${i % 3 !== 0 ? 'lg:border-l lg:border-rule' : 'lg:pl-0'} ${i % 2 !== 0 ? 'sm:border-l sm:border-rule lg:border-l-0' : ''} ${i % 3 !== 0 ? 'lg:border-l' : ''}`}>
              <div className="flex items-baseline justify-between border-t-2 border-body pt-2">
                <h2 className={`${kicker} !text-body`}><Link href={`/section/${s.slug}`} className="hover:underline underline-offset-4">{s.name}</Link></h2>
                <Link href={`/section/${s.slug}`} className="text-[12px] text-sub hover:text-brand">{t.more}</Link>
              </div>
              <Link href={`/news/${lead.id}`} className="headline-link group mt-3 block">
                <Thumb sizes="(max-width: 1023px) 100vw, 360px" src={lead.thumbnail_url} alt="" ratio="3 / 2" />
                <h3 className="headline-text mt-3 line-clamp-3 text-[19px] font-bold leading-[1.38] tracking-[-0.015em]">{lead.title}</h3>
                {lead.excerpt && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-sub">{lead.excerpt}</p>}
              </Link>
              <ul className="mt-3 divide-y divide-rule border-t border-rule">
                {rest.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    <Link href={`/news/${a.id}`} className="headline-link group block py-2.5">
                      <p className="headline-text line-clamp-2 text-[15px] font-semibold leading-[1.42]">{a.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
