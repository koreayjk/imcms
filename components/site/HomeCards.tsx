import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PublicArticle } from '@/lib/public-data'
import type { SectionConfig, SiteConfig } from '@/lib/sites'
import { formatDate } from '@/lib/format'
import { siteText } from '@/lib/site-text'
import Thumb from './Thumb'
import HeroSlider from './HeroSlider'

// 홈 배치 '미국 스타일 2 · 카드 매거진' (homeLayout = 'cards')
//   큰 히어로 사진(제목은 사진 위) → 둥근 카드 그리드 → 많이 본 기사 → 섹션별 카드 줄 (휴대폰은 옆으로 밀어서 봄)
//   여백이 넓고 사진이 큰 요즘 지역 언론 스타일. 뉴스레터는 하단(SiteFooter)에 있다

type Props = {
  site: SiteConfig
  headline: PublicArticle
  subTops: PublicArticle[]
  underHeadline: PublicArticle[]
  major: PublicArticle[]
  picks: PublicArticle[]
  mostViewed: PublicArticle[]
  bySection: Record<string, PublicArticle[]>
  sections: SectionConfig[]
  middleAd?: ReactNode
  sideExtras?: ReactNode
  // 톱 헤드라인 슬라이드(홈 편집판에서 정한 2개 이상의 기사)와 넘어가는 간격(초)
  slides?: PublicArticle[]
  heroSeconds?: number
}

function Chip({ a, light = false }: { a: PublicArticle; light?: boolean }) {
  if (!a.category) return null
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${light ? 'bg-white/95 text-brand' : 'bg-soft text-gold-ink'}`}>{a.category.name}</span>
  )
}

function Card({ a, lang, tz, excerpt = false }: { a: PublicArticle; lang: SiteConfig['lang']; tz?: string; excerpt?: boolean }) {
  return (
    <Link href={`/news/${a.id}`} className="headline-link group block">
      <Thumb sizes="(max-width: 1023px) 80vw, 380px" src={a.thumbnail_url} alt="" ratio="16 / 10" className="rounded-xl" />
      <div className="mt-3.5">
        <Chip a={a} />
        <h3 className="headline-text mt-2 line-clamp-3 text-[18px] font-bold leading-[1.4] tracking-[-0.02em]">{a.title}</h3>
        {excerpt && a.excerpt && <p className="mt-1.5 line-clamp-2 text-[14px] leading-[1.6] text-sub">{a.excerpt}</p>}
        <time dateTime={a.published_at ?? undefined} className="mt-2 block text-[12.5px] text-[#8A918C]">{formatDate(a.published_at, lang, tz)}</time>
      </div>
    </Link>
  )
}

function RowHead({ title, href, more }: { title: string; href?: string; more: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <h2 className="text-[24px] font-extrabold tracking-[-0.03em] text-body sm:text-[26px]">{title}</h2>
      {href && <Link href={href} className="flex-shrink-0 rounded-full border border-rule px-3.5 py-1.5 text-[12.5px] font-semibold text-sub hover:border-brand hover:text-brand">{more} →</Link>}
    </div>
  )
}

export default function HomeCards({ site, headline, subTops, underHeadline, major, picks, mostViewed, bySection, sections, middleAd, sideExtras, slides, heroSeconds }: Props) {
  const L = site.lang
  const t = siteText(site)
  const topCards = [...subTops.slice(0, 2), ...underHeadline].slice(0, 6)
  const boxes = sections.filter((s) => (bySection[s.slug] ?? []).length > 0).slice(0, 6)

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-6">
      {/* ── 히어로 ── */}
      <section aria-label={t.topStories} className="pt-5 lg:pt-7">
        {(() => {
          const hero = (h: PublicArticle) => (
            <Link href={`/news/${h.id}`} className="headline-link group relative block overflow-hidden rounded-2xl">
              <div className="hs-photo overflow-hidden"><Thumb sizes="(max-width: 1023px) 100vw, 1200px" src={h.thumbnail_url} alt={h.title} ratio="16 / 10" className="lg:!aspect-[21/9]" /></div>
              <div className="hs-text absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-5 pt-24 text-white sm:px-9 sm:pb-8">
                <Chip a={h} light />
                <h2 className="mt-3 line-clamp-3 max-w-[900px] text-balance text-[25px] font-extrabold leading-[1.28] tracking-[-0.03em] sm:text-[38px]">{h.title}</h2>
                {h.excerpt && <p className="mt-2.5 hidden max-w-[760px] line-clamp-2 text-[16px] leading-[1.6] text-white/85 sm:block">{h.excerpt}</p>}
              </div>
            </Link>
          )
          return slides && slides.length > 1
            ? <HeroSlider seconds={heroSeconds ?? 5} label={t.topStories} brand={site.colors.brand}>{slides.map((h) => <div key={h.id}>{hero(h)}</div>)}</HeroSlider>
            : hero(headline)
        })()}
      </section>

      {/* ── 주요 카드 ── */}
      {topCards.length > 0 && (
        <section className="pt-10 lg:pt-12">
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-7 sm:gap-y-9 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {topCards.map((a) => <li key={a.id} className="w-[78%] flex-shrink-0 snap-start sm:w-auto"><Card a={a} lang={L} tz={site.timeZone} excerpt /></li>)}
          </ul>
        </section>
      )}

      {picks.length > 0 && (
        <section aria-labelledby="pick-title" className="mt-10 rounded-2xl bg-soft px-5 py-5 sm:px-7">
          <h2 id="pick-title" className="mb-3 text-[15px] font-extrabold text-gold-ink">{t.pick}</h2>
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {picks.map((a) => (
              <li key={a.id}><Link href={`/news/${a.id}`} className="headline-text line-clamp-2 text-[14.5px] font-semibold leading-[1.45] hover:underline underline-offset-2">{a.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      {middleAd}

      {/* ── 많이 본 기사 ── */}
      {mostViewed.length > 0 && (
        <section id="popular" aria-label={t.popular} className="mt-12 scroll-mt-28">
          <RowHead title={t.popular} more={t.more} />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {mostViewed.slice(0, 5).map((a, i) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="group block h-full rounded-xl border border-rule p-4 transition-colors hover:border-brand">
                  <span className="text-[26px] font-extrabold leading-none text-brand">{i + 1}</span>
                  <span className="mt-2 line-clamp-3 block text-[14.5px] font-semibold leading-[1.5] group-hover:underline underline-offset-2">{a.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── 주요뉴스 + 섹션별 카드 줄 ── */}
      {[...(major.length ? [{ slug: '__major', name: t.majorShort, items: major.slice(0, 4), href: undefined as string | undefined }] : []),
        ...boxes.map((s) => ({ slug: s.slug, name: s.name, items: (bySection[s.slug] ?? []).slice(0, 4), href: `/section/${s.slug}` as string | undefined }))].map((row) => (
        <section key={row.slug} id={row.slug === '__major' ? 'major' : undefined} className="mt-14 scroll-mt-28">
          <RowHead title={row.name} href={row.href} more={t.more} />
          <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {row.items.map((a) => (
              <li key={a.id} className="w-[72%] flex-shrink-0 snap-start sm:w-auto"><Card a={a} lang={L} tz={site.timeZone} /></li>
            ))}
          </ul>
        </section>
      ))}

      {sideExtras && <div className="mx-auto mt-12 max-w-[640px] space-y-9">{sideExtras}</div>}
    </div>
  )
}
