import Link from 'next/link'
import type { Metadata } from 'next'
import { currentSite, getHomeData, isDemo, type PublicArticle } from '@/lib/public-data'
import { formatDate, formatShort } from '@/lib/format'
import SiteFrame from '@/components/site/SiteFrame'
import SectionHeading from '@/components/site/SectionHeading'
import MostViewed from '@/components/site/MostViewed'
import SpecialtyTabs from '@/components/site/SpecialtyTabs'
import Thumb from '@/components/site/Thumb'
import { AdSlot, CategoryLabel, TitleList } from '@/components/site/items'

export function generateMetadata(): Metadata {
  const site = currentSite()
  return {
    title: `${site.name} | ${site.nameEn}`,
    description: site.description,
    icons: { icon: site.logoMark },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
    openGraph: { title: site.name, description: site.description, siteName: site.name, locale: 'ko_KR', type: 'website' },
  }
}

export default async function HomePage() {
  const site = currentSite()
  const { latest, mostViewed, bySection, pinned } = await getHomeData(site)

  if (!latest.length) {
    return (
      <SiteFrame site={site}>
        <div className="mx-auto max-w-[1200px] px-4 py-28 text-center">
          <p className="text-[18px] font-semibold text-body">아직 발행된 기사가 없습니다.</p>
          <p className="mt-2 text-[14px] text-sub">편집국에서 기사를 발행하면 이곳에 표시됩니다.</p>
        </div>
      </SiteFrame>
    )
  }

  const used = new Set<string>()
  const take = (n: number, pred: (a: PublicArticle) => boolean = () => true) => {
    const out: PublicArticle[] = []
    for (const a of latest) {
      if (out.length >= n) break
      if (used.has(a.id) || !pred(a)) continue
      out.push(a)
      used.add(a.id)
    }
    return out
  }
  const hasImage = (a: PublicArticle) => !!a.thumbnail_url

  // 편집판에서 고정한 기사가 먼저, 빈 자리는 최신 기사로 자동 배치
  Object.values(pinned).flat().forEach((a) => a && used.add(a.id))
  const fill = (slots: (PublicArticle | null)[], pred: (a: PublicArticle) => boolean) =>
    slots.map((a) => a ?? take(1, pred)[0] ?? take(1)[0] ?? null).filter((a): a is PublicArticle => !!a)

  const headline =
    pinned.headline[0] ?? take(1, (a) => a.is_featured && hasImage(a))[0] ?? take(1, hasImage)[0] ?? take(1)[0]
  const subTops = fill(pinned.top, hasImage)
  const realtime = take(5)
  const major = fill(pinned.major, hasImage)
  const picks = pinned.pick.filter((a): a is PublicArticle => !!a)

  const specialty = site.sections.filter((s) => s.specialty)
  const general = site.sections.filter((s) => !s.specialty)

  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[1200px] px-4">
        {/* ── 톱 기사: PC ── */}
        <section aria-label="톱 기사" className="hidden grid-cols-[250px_1fr_300px] gap-8 border-b border-rule py-7 lg:grid">
          <div className="divide-y divide-rule">
            {subTops.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="headline-link group block py-5 first:pt-0">
                <Thumb src={a.thumbnail_url} alt={a.title} ratio="5 / 3" />
                <CategoryLabel article={a} className="mt-3" />
                <h3 className="headline-text mt-1 line-clamp-2 text-[17px] font-bold leading-[1.4] tracking-[-0.02em]">{a.title}</h3>
                {a.excerpt && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-sub">{a.excerpt}</p>}
              </Link>
            ))}
          </div>

          <Link href={`/news/${headline.id}`} className="headline-link group block">
            <Thumb src={headline.thumbnail_url} alt={headline.title} ratio="16 / 10" />
            <div className="mt-5 px-4 text-center">
              <CategoryLabel article={headline} />
              <h2 className="headline-text mt-1.5 line-clamp-2 text-balance text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-body">
                {headline.title}
              </h2>
              {headline.excerpt && <p className="mt-3 line-clamp-2 text-[15px] leading-[1.6] text-sub">{headline.excerpt}</p>}
            </div>
          </Link>

          <aside>
            <SectionHeading title="실시간 뉴스" as="h3" />
            <RealtimeList items={realtime} />
          </aside>
        </section>

        {/* ── 톱 기사: 모바일 (좌우로 넘기기) ── */}
        <section aria-label="톱 기사" className="-mx-4 pt-4 lg:hidden">
          <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {[headline, ...subTops].map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="w-[86%] flex-shrink-0 snap-center border border-rule bg-white">
                <div className="px-4 pb-3 pt-4">
                  <CategoryLabel article={a} />
                  <h2 className="mt-1 line-clamp-2 text-[20px] font-bold leading-[1.38] tracking-[-0.03em]">{a.title}</h2>
                </div>
                <Thumb src={a.thumbnail_url} alt={a.title} ratio="16 / 10" />
                {a.excerpt && <p className="line-clamp-2 px-4 py-3 text-[14px] leading-[1.6] text-sub">{a.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>

        {/* ── 주요뉴스 + 많이 본 뉴스 ── */}
        <div className="grid gap-10 py-8 lg:grid-cols-[1fr_300px]">
          <section id="major" className="scroll-mt-28">
            <SectionHeading title="주요뉴스" />
            <ul className="divide-y divide-rule lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-8 lg:divide-y-0">
              {major.map((a) => (
                <li key={a.id} className="py-4 first:pt-0 lg:py-0">
                  <Link href={`/news/${a.id}`} className="headline-link group flex gap-3.5 lg:block">
                    <Thumb src={a.thumbnail_url} alt={a.title} ratio="3 / 2" className="w-[118px] flex-shrink-0 lg:w-full" />
                    <div className="min-w-0 flex-1 lg:mt-3">
                      <CategoryLabel article={a} className="hidden lg:block" />
                      <h3 className="headline-text line-clamp-2 text-[16px] font-bold leading-[1.42] tracking-[-0.02em] lg:mt-1">{a.title}</h3>
                      {a.excerpt && <p className="mt-1 hidden line-clamp-2 text-[13px] leading-[1.55] text-sub lg:block">{a.excerpt}</p>}
                      <time dateTime={a.published_at ?? undefined} className="mt-1.5 block text-[12px] text-[#8A918C] tabular-nums">
                        {formatDate(a.published_at)}
                      </time>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <aside className="space-y-9">
            <div id="realtime" className="scroll-mt-28 lg:hidden">
              <SectionHeading title="실시간 뉴스" as="h3" />
              <RealtimeList items={realtime} />
            </div>
            <div id="popular" className="scroll-mt-28">
              <MostViewed items={mostViewed} />
            </div>
            {isDemo && <AdSlot label="광고 영역 300×250" className="hidden h-[250px] lg:flex" />}
          </aside>
        </div>
      </div>

      {/* ── 이슈 PICK (편집판에서 채운 경우만) ── */}
      {picks.length > 0 && (
        <section aria-labelledby="pick-title" className="mx-auto mb-9 max-w-[1200px] px-4">
          <div className="border-t-[3px] border-gold pt-4">
            <h2 id="pick-title" className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-gold-ink">이슈 PICK</h2>
            <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {picks.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="headline-link group block border-l-2 border-rule pl-3 hover:border-gold">
                    <CategoryLabel article={a} />
                    <p className="headline-text mt-0.5 line-clamp-2 text-[15px] font-semibold leading-[1.45]">{a.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── 케어 전문뉴스 ── */}
      <section aria-labelledby="specialty-title" className="border-y border-rule bg-soft py-9">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-serif text-[11px] tracking-[0.24em] text-gold-ink">{site.nameEn} SPECIAL</p>
              <h2 id="specialty-title" className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-brand">케어 전문뉴스</h2>
            </div>
            <p className="hidden text-[13px] text-sub lg:block">{site.description}</p>
          </div>

          <div className="hidden grid-cols-4 gap-5 lg:grid">
            {specialty.map((s) => {
              const [lead, ...rest] = bySection[s.slug] ?? []
              return (
                <div key={s.slug} className="flex flex-col border-t-[3px] border-brand bg-white p-5">
                  <h3 className="text-[17px] font-bold tracking-[-0.02em] text-brand">
                    <Link href={`/section/${s.slug}`} className="hover:underline underline-offset-4">{s.name}</Link>
                  </h3>
                  <p className="mt-0.5 text-[12px] text-sub">{s.description}</p>
                  {lead ? (
                    <>
                      <Link href={`/news/${lead.id}`} className="headline-link group mt-4 block">
                        <Thumb src={lead.thumbnail_url} alt={lead.title} ratio="3 / 2" />
                        <p className="headline-text mt-3 line-clamp-2 text-[15.5px] font-bold leading-[1.42]">{lead.title}</p>
                      </Link>
                      <TitleList items={rest.slice(0, 3)} className="mt-4 border-t border-rule pt-4" />
                    </>
                  ) : (
                    <p className="py-10 text-center text-[13px] text-sub">아직 발행된 기사가 없습니다.</p>
                  )}
                  <Link href={`/section/${s.slug}`} className="mt-auto pt-4 text-[12.5px] text-sub hover:text-brand">
                    {s.name} 더보기 +
                  </Link>
                </div>
              )
            })}
          </div>

          <div className="lg:hidden">
            <SpecialtyTabs
              tabs={specialty.map((s) => ({ slug: s.slug, name: s.name, description: s.description, articles: bySection[s.slug] ?? [] }))}
            />
          </div>
        </div>
      </section>

      {/* ── 종합 섹션 ── */}
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
        {general.map((s) => {
          const [lead, ...rest] = bySection[s.slug] ?? []
          return (
            <section key={s.slug}>
              <SectionHeading title={s.name} href={`/section/${s.slug}`} />
              {lead ? (
                <>
                  <Link href={`/news/${lead.id}`} className="headline-link group flex gap-3 lg:block">
                    {lead.thumbnail_url && (
                      <Thumb src={lead.thumbnail_url} alt={lead.title} ratio="3 / 2" className="w-[118px] flex-shrink-0 lg:w-full" />
                    )}
                    <p className="headline-text line-clamp-2 text-[15.5px] font-bold leading-[1.42] lg:mt-3">{lead.title}</p>
                  </Link>
                  <TitleList items={rest.slice(0, 4)} className="mt-4" />
                </>
              ) : (
                <p className="py-6 text-[13px] text-sub">아직 발행된 기사가 없습니다.</p>
              )}
            </section>
          )
        })}
      </div>
    </SiteFrame>
  )
}

function RealtimeList({ items }: { items: PublicArticle[] }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/news/${a.id}`} className="group flex gap-3 py-3">
            <div className="min-w-0 flex-1">
              <time dateTime={a.published_at ?? undefined} className="text-[12px] font-semibold text-brand tabular-nums">
                {formatShort(a.published_at)}
              </time>
              <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.45] group-hover:underline underline-offset-2">{a.title}</p>
            </div>
            {a.thumbnail_url && <Thumb src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[84px] flex-shrink-0" />}
          </Link>
        </li>
      ))}
    </ul>
  )
}
