import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { currentSite, getHomeData, getIndexSeries, isDemo, siteBaseUrl, type PublicArticle } from '@/lib/public-data'
import { siteJsonLd } from '@/lib/news-jsonld'
import { outletApp } from '@/lib/android'
import { topSections, siteIcon, withLayout } from '@/lib/sites'
import IndexWidget from '@/components/site/IndexWidget'
import StatsBoard from '@/components/site/StatsBoard'
import { formatDate, formatShort } from '@/lib/format'
import SiteFrame from '@/components/site/SiteFrame'
import SectionHeading from '@/components/site/SectionHeading'
import MostViewed from '@/components/site/MostViewed'
import FitRows from '@/components/site/FitRows'
import WingFill from '@/components/site/WingFill'
import HeroSlider from '@/components/site/HeroSlider'
import MobileHero from '@/components/site/MobileHero'
import ArticleRow from '@/components/site/ArticleRow'
import SpecialtyTabs from '@/components/site/SpecialtyTabs'
import Thumb from '@/components/site/Thumb'
import { AdSlot, CategoryLabel, TitleList } from '@/components/site/items'
import AdArea from '@/components/site/AdArea'
import HomeBands from '@/components/site/HomeBands'
import HomePortal from '@/components/site/HomePortal'
import HomeEditorial from '@/components/site/HomeEditorial'
import HomeCards from '@/components/site/HomeCards'
import HomeBandsTop from '@/components/site/HomeBandsTop'
import { siteText } from '@/lib/site-text'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return {
    title: `${site.name} | ${site.nameEn}`,
    description: site.description,
    icons: { icon: siteIcon(site) },
    // 독자용 앱이 있는 매체만 앱 설치 정보 (lib/android.ts)
    ...(outletApp(site.domains) ? { manifest: '/site.webmanifest' } : {}),
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
    openGraph: { title: site.name, description: site.description, siteName: site.name, locale: siteText(site).ogLocale, type: 'website', images: site.ogImage ? [{ url: site.ogImage, width: 1200, height: 630 }] : undefined },
    twitter: { card: site.ogImage ? 'summary_large_image' : 'summary' },
    alternates: { types: { 'application/rss+xml': [{ url: '/rss.xml', title: site.name }] } },
    // 네이버 서치어드바이저·구글 서치콘솔 소유 확인 (홈페이지 설정에서 넣는다)
    verification: {
      google: site.verification?.google,
      other: {
        ...(site.verification?.naver ? { 'naver-site-verification': site.verification.naver } : {}),
        ...(site.verification?.bing ? { 'msvalidate.01': site.verification.bing } : {}),
      },
    },
  }
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ layout?: string }> }) {
  let site = await currentSite()
  // 홈페이지 설정의 "미리보기": 저장하기 전에 다른 배치로 보기. 미리보기 주소(도메인 연결 전)에서만 적용한다
  const wanted = (await searchParams).layout
  if (site.preview || isDemo || site.layoutDemo) site = withLayout(site, wanted)
  const t = siteText(site)
  const L = site.lang
  const [{ latest, mostViewed, bySection, pinned, heroSeconds }, indexSeries] = await Promise.all([getHomeData(site), getIndexSeries(site)])

  if (!latest.length) {
    return (
      <SiteFrame site={site}>
        <div className="mx-auto max-w-[1200px] px-4 py-28 text-center">
          <p className="text-[18px] font-semibold text-body">{t.noArticles}</p>
          <p className="mt-2 text-[14px] text-sub">{t.noArticlesSub}</p>
        </div>
        {/* 기사가 아직 없어도 첫 화면 팝업 광고는 띄운다 */}
        <AdArea site={site} slot="popup" />
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

  // 톱 헤드라인: 편집판에서 고른 기사(최대 10개). 2개 이상이면 홈 가운데에서 자동으로 넘어가는 슬라이드가 된다
  const heroSlides = pinned.headline.filter((a): a is PublicArticle => !!a)
  const headline =
    heroSlides[0] ?? take(1, (a) => a.is_featured && hasImage(a))[0] ?? take(1, hasImage)[0] ?? take(1)[0]
  const subTops = fill(pinned.top, hasImage)
  // 실시간 뉴스: PC는 왼쪽 두 기사 높이에 맞춰 7건, 휴대폰은 5건
  const realtime = take(7)
  // 헤드라인 아래 작은 기사 4건 (가운데가 비어 보이지 않게)
  const underHeadline = take(4)
  const major = fill(pinned.major, hasImage)
  // 오른쪽 광고(최대 10개)가 길어지면 왼쪽 빈자리에 채울 덤 기사 (화면에서 오른쪽 높이에 맞춰 연다. 기사가 모자라면 있는 만큼만)
  const usedBeforeMore = new Set(used)
  const majorMore = site.homeLayout === 'bands' ? [] : take(36)
  const picks = pinned.pick.filter((a): a is PublicArticle => !!a)

  // 섹션 띠 배치 (Israel Today 등): 톱 기사 아래를 설정한 섹션 순서대로 쌓는다
  const bandsMode = site.homeLayout === 'bands' && !!site.bands?.length
  // 띠를 자동 구성한 한국 스타일 3은 첫 화면(PC)도 전용 모양 (직접 정한 띠가 있는 매체는 예전 첫 화면 그대로)
  const splitTop = bandsMode && !!site.autoBands
  const specialty = topSections(site).filter((s) => s.specialty)
  const general = topSections(site).filter((s) => !s.specialty)

  const base = siteBaseUrl(site, (await headers()).get('host'))

  // 넓은 화면의 오른쪽 여백 광고가 본문보다 길어지면, 그 왼쪽 빈자리에 이어서 채울 기사 (화면에서 빈자리에 들어가는 만큼만 연다)
  const onPage = new Set<string>([...used, ...mostViewed.map((a) => a.id), ...Object.values(bySection).flatMap((l) => l.slice(0, 5).map((a) => a.id))])
  const spare = latest.filter((a) => !onPage.has(a.id))
  // (덤 기사로 다 쓰여 남은 기사가 모자라면, 덤 기사 앞까지 쓴 기사를 뺀 나머지에서 채운다)
  const pool = spare.length >= 6 ? spare : latest.filter((a) => !usedBeforeMore.has(a.id))
  // 종합 섹션이 4칸 단위로 떨어지지 않으면 남는 칸(PC)에 최신 기사를 채운다
  const gap = general.length % 4 ? 4 - (general.length % 4) : 0
  // 남는 칸마다 사진 있는 기사 1건 + 제목 3건 (다른 섹션 칸과 같은 모양)
  const gapLeads = pool.filter(hasImage).slice(0, gap)
  const gapTitles = pool.filter((a) => !gapLeads.includes(a)).slice(0, gap * 3)
  const gapUsed = new Set([...gapLeads, ...gapTitles].map((a) => a.id))
  const wingFill = (
    <WingFill title={L === 'en' ? 'More stories' : '기사 더 보기'}>
      {pool.filter((a) => !gapUsed.has(a.id)).slice(0, 40).map((a) => <ArticleRow key={a.id} article={a} showCategory tz={site.timeZone} lang={L} />)}
    </WingFill>
  )

  // 화면 전체를 새로 짠 배치: 한국 스타일 2(portal) · 미국 스타일 1(editorial) · 미국 스타일 2(cards)
  const layoutKey = site.homeLayout
  if (layoutKey === 'portal' || layoutKey === 'editorial' || layoutKey === 'cards') {
    const middleAd = <AdArea site={site} slot="home_middle" className="pt-5" />
    const sideExtras = (
      <>
        {indexSeries && <IndexWidget series={indexSeries} />}
        {site.statsBoard && <StatsBoard board={site.statsBoard} />}
        {isDemo && <AdSlot label={L === 'en' ? 'Ad 300×250' : '광고 영역 300×250'} className="hidden h-[250px] lg:flex" />}
        <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
      </>
    )
    const common = { site, headline, subTops, underHeadline, major, picks, mostViewed, bySection, sections: topSections(site), middleAd, sideExtras, slides: heroSlides, heroSeconds }
    return (
      <SiteFrame site={site} home>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd(site, base) }} />
        {layoutKey === 'editorial' ? <HomeEditorial {...common} realtime={realtime} />
          : layoutKey === 'cards' ? <HomeCards {...common} />
          : <HomePortal {...common} breaking={realtime.slice(0, 5)} />}
        {wingFill}
        <AdArea site={site} slot="popup" />
      </SiteFrame>
    )
  }

  return (
    <SiteFrame site={site} home>
      {/* 매체 이름·로고 구조화 데이터 (구글 검색·구글 뉴스용, 화면에는 안 보임) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd(site, base) }} />
      <div className="mx-auto max-w-[1200px] px-4">
        {splitTop && <HomeBandsTop site={site} headline={headline} items={[...subTops.slice(0, 2), ...underHeadline].slice(0, 4)} slides={heroSlides} heroSeconds={heroSeconds} />}
        {!splitTop && (
          <>
        {/* ── 톱 기사: PC ── */}
        <section aria-label={t.topStories} className="hidden grid-cols-[250px_1fr_300px] gap-8 border-b border-rule py-7 lg:grid">
          <div className="divide-y divide-rule">
            {subTops.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="headline-link group block py-5 first:pt-0">
                <Thumb src={a.thumbnail_url} alt={a.title} ratio="4 / 3" />
                <CategoryLabel article={a} className="mt-3" />
                <h3 className="headline-text mt-1 line-clamp-2 text-[17px] font-bold leading-[1.4] tracking-[-0.02em]">{a.title}</h3>
                {a.excerpt && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-sub">{a.excerpt}</p>}
              </Link>
            ))}
          </div>

          <div className="min-w-0">
            {(() => {
              const hero = (a: PublicArticle) => (
                <Link href={`/news/${a.id}`} className="headline-link group block">
                  <div className="hs-photo overflow-hidden"><Thumb sizes="(max-width: 768px) 100vw, 720px" src={a.thumbnail_url} alt={a.title} ratio="16 / 10" /></div>
                  <div className="hs-text mt-5 px-4 text-center">
                    <CategoryLabel article={a} />
                    <h2 className="headline-text mt-1.5 line-clamp-2 text-balance text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-body">
                      {a.title}
                    </h2>
                    {a.excerpt && <p className="mt-3 line-clamp-2 text-[15px] leading-[1.6] text-sub">{a.excerpt}</p>}
                  </div>
                </Link>
              )
              return heroSlides.length > 1
                ? <HeroSlider seconds={heroSeconds ?? 5} label={t.topStories} brand={site.colors.brand}>{heroSlides.map((a) => <div key={a.id}>{hero(a)}</div>)}</HeroSlider>
                : hero(headline)
            })()}
            {underHeadline.length > 0 && (
              <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-4">
                {underHeadline.map((a) => (
                  <li key={a.id}>
                    <Link href={`/news/${a.id}`} className="headline-link group flex gap-3">
                      {a.thumbnail_url && <Thumb sizes="120px" src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[88px] flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <CategoryLabel article={a} />
                        <p className="headline-text mt-0.5 line-clamp-2 text-[14.5px] font-semibold leading-[1.45]">{a.title}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside>
            <SectionHeading title={t.realtime} as="h3" lang={L} />
            <RealtimeList items={realtime} lang={L} />
          </aside>
        </section>
          </>
        )}

        {/* ── 톱 기사: 모바일 (화면 폭 꽉 찬 큰 사진 + 큰 제목, 2개 이상이면 자동으로 넘어감) ── */}
        {!splitTop && <section aria-label={t.topStories} className="-mx-4 lg:hidden">
          <MobileHero seconds={heroSeconds ?? 5} label={t.topStories} bg={site.colors.brandDark} accent={site.colors.gold}>
            {(heroSlides.length > 1 ? heroSlides : [headline, ...subTops]).map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="group block text-white">
                <div className="relative">
                  <div className="hs-photo overflow-hidden"><Thumb sizes="100vw" src={a.thumbnail_url} alt={a.title} ratio="4 / 3" /></div>
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]" style={{ background: `linear-gradient(to top, ${site.colors.brandDark} 6%, ${site.colors.brandDark}CC 38%, transparent)` }} />
                </div>
                <div className="hs-text relative -mt-14 px-6 pb-5">
                  {a.category && <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: site.colors.gold }}>{a.category.name}</p>}
                  <h2 className="mt-2 line-clamp-3 text-balance text-[27px] font-extrabold leading-[1.28] tracking-[-0.035em] text-white">{a.title}</h2>
                  {a.excerpt && <p className="mt-2.5 line-clamp-2 text-[14px] leading-[1.6] text-white/65">{a.excerpt}</p>}
                </div>
              </Link>
            ))}
          </MobileHero>
        </section>}

        {!bandsMode && (
          <>
        {/* ── 주요뉴스 + 많이 본 뉴스 ── */}
        <div data-fit-grid className="grid grid-cols-1 gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section id="major" className="scroll-mt-28">
            <SectionHeading title={t.majorShort} lang={L} />
            <FitRows min={Math.ceil(major.length / 3)} className="lg:[&>*+*]:mt-8">
              {Array.from({ length: Math.ceil((major.length + majorMore.length) / 3) }, (_, r) => [...major, ...majorMore].slice(r * 3, r * 3 + 3)).map((row) => (
                <ul key={row[0].id} className="divide-y divide-rule lg:grid lg:grid-cols-3 lg:gap-x-6 lg:divide-y-0">
                  {row.map((a) => (
                  <li key={a.id} className="py-4 first:pt-0 lg:py-0">
                    <Link href={`/news/${a.id}`} className="headline-link group flex gap-3.5 lg:block">
                      <Thumb sizes="(max-width: 1023px) 118px, 300px" src={a.thumbnail_url} alt={a.title} ratio="3 / 2" className="w-[118px] flex-shrink-0 lg:w-full" />
                      <div className="min-w-0 flex-1 lg:mt-3">
                        <CategoryLabel article={a} className="hidden lg:block" />
                        <h3 className="headline-text line-clamp-2 text-[16px] font-bold leading-[1.42] tracking-[-0.02em] lg:mt-1">{a.title}</h3>
                        {a.excerpt && <p className="mt-1 hidden line-clamp-2 text-[13px] leading-[1.55] text-sub lg:block">{a.excerpt}</p>}
                        <time dateTime={a.published_at ?? undefined} className="mt-1.5 block text-[12px] text-[#8A918C] tabular-nums">
                          {formatDate(a.published_at, L)}
                        </time>
                      </div>
                    </Link>
                  </li>
                  ))}
                </ul>
              ))}
            </FitRows>
          </section>

          <aside data-fit-side className="space-y-9">
            <div id="realtime" className="scroll-mt-28 lg:hidden">
              <SectionHeading title={t.realtime} as="h3" lang={L} />
              <RealtimeList items={realtime.slice(0, 5)} lang={L} />
            </div>
            {/* 해운 운임지수 (홈페이지 설정에서 켠 매체만) */}
            {indexSeries && <IndexWidget series={indexSeries} />}
            {/* 숫자 판 (홈페이지 설정에서 채운 매체만) */}
            {site.statsBoard && <StatsBoard board={site.statsBoard} />}
            <div id="popular" className="scroll-mt-28">
              <MostViewed items={mostViewed} lang={L} />
            </div>
            {isDemo && <AdSlot label={L === 'en' ? 'Ad 300×250' : '광고 영역 300×250'} className="hidden h-[250px] lg:flex" />}
            <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
          </aside>
        </div>
          </>
        )}
        {!bandsMode && <AdArea site={site} slot="home_middle" className="pb-8" />}
      </div>
      <AdArea site={site} slot="popup" />

      {/* ── 이슈 PICK (편집판에서 채운 경우만) ── */}
      {picks.length > 0 && (
        <section aria-labelledby="pick-title" className="mx-auto mb-9 max-w-[1200px] px-4">
          <div className="border-t-[3px] border-gold pt-4">
            <h2 id="pick-title" className="mb-4 text-[18px] font-bold tracking-[-0.02em] text-gold-ink">{t.pick}</h2>
            <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {picks.map((a) => (
                <li key={a.id}>
                  <Link href={`/news/${a.id}`} className="headline-link group block">
                    {a.thumbnail_url && <Thumb sizes="(max-width: 1023px) 50vw, 280px" src={a.thumbnail_url} alt={a.title} ratio="3 / 2" className="mb-2.5" />}
                    <div className="border-l-2 border-rule pl-3 group-hover:border-gold">
                      <CategoryLabel article={a} />
                      <p className="headline-text mt-0.5 line-clamp-2 text-[15px] font-semibold leading-[1.45]">{a.title}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {bandsMode && (
        <HomeBands
          site={site}
          bands={site.bands!}
          bySection={bySection}
          mostViewed={mostViewed}
          used={used}
          ad={<AdArea site={site} slot="home_middle" className="mx-auto max-w-[1200px] px-4 pb-8" />}
          sidebarAd={<AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />}
        />
      )}

      {!bandsMode && (
        <>
      {/* ── 전문뉴스 (매체 설정의 전문 섹션, 없으면 이 줄을 통째로 뺀다) ── */}
      {specialty.length > 0 && (
      <section aria-labelledby="specialty-title" className="border-y border-rule bg-soft py-9">
        <div className="mx-auto max-w-[1200px] px-4">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-serif text-[11px] tracking-[0.24em] text-gold-ink">{L === 'en' ? site.name.toUpperCase() : `${site.nameEn} SPECIAL`}</p>
              <h2 id="specialty-title" className="mt-1 text-[24px] font-extrabold tracking-[-0.03em] text-brand">{site.specialtyTitle}</h2>
            </div>
            <p className="hidden text-[13px] text-sub lg:block">{site.description}</p>
          </div>

          {/* 전문 섹션 수에 맞춰 한 줄로 (3·4·5개), 6개 이상이면 3개씩 */}
          <div
            className="hidden gap-5 lg:grid"
            style={{ gridTemplateColumns: `repeat(${specialty.length <= 5 ? specialty.length : specialty.length % 4 === 0 ? 4 : 3}, minmax(0, 1fr))` }}
          >
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
                    <p className="py-10 text-center text-[13px] text-sub">{t.noArticles}</p>
                  )}
                  <Link href={`/section/${s.slug}`} className="mt-auto pt-4 text-[12.5px] text-sub hover:text-brand">
                    {t.moreOf(s.name)}
                  </Link>
                </div>
              )
            })}
          </div>

          <div className="lg:hidden">
            <SpecialtyTabs lang={L}
              title={site.specialtyTitle}
              tabs={specialty.map((s) => ({ slug: s.slug, name: s.name, description: s.description, articles: bySection[s.slug] ?? [] }))}
            />
          </div>
        </div>
      </section>
      )}

      {/* ── 종합 섹션 ── */}
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 pt-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7">
        {general.map((s) => {
          const [lead, ...rest] = bySection[s.slug] ?? []
          return (
            <section key={s.slug}>
              <SectionHeading title={s.name} href={`/section/${s.slug}`} lang={L} />
              {lead ? (
                <>
                  <Link href={`/news/${lead.id}`} className="headline-link group flex gap-3 lg:block">
                    {lead.thumbnail_url && (
                      <Thumb sizes="(max-width: 1023px) 118px, 300px" src={lead.thumbnail_url} alt={lead.title} ratio="3 / 2" className="w-[118px] flex-shrink-0 lg:w-full" />
                    )}
                    <p className="headline-text line-clamp-2 text-[15.5px] font-bold leading-[1.42] lg:mt-3">{lead.title}</p>
                  </Link>
                  <TitleList items={rest.slice(0, 4)} className="mt-4" />
                </>
              ) : (
                <p className="py-6 text-[13px] text-sub">{t.noArticles}</p>
              )}
            </section>
          )
        })}
        {gap > 0 && gapLeads.length === gap && gapTitles.length === gap * 3 && gapLeads.map((lead, i) => (
          <section key={lead.id} className="hidden lg:block">
            <SectionHeading title={(L === 'en' ? ['Latest stories', 'Also in the news', 'More to read'] : ['최신 기사', '주목 기사', '더 읽을거리'])[i] ?? ''} lang={L} />
            <Link href={`/news/${lead.id}`} className="headline-link group block">
              <Thumb sizes="300px" src={lead.thumbnail_url} alt={lead.title} ratio="3 / 2" />
              <p className="headline-text mt-3 line-clamp-2 text-[15.5px] font-bold leading-[1.42]">{lead.title}</p>
            </Link>
            <TitleList items={gapTitles.slice(i * 3, i * 3 + 3)} className="mt-4" />
          </section>
        ))}
      </div>
        </>
      )}
      {wingFill}
    </SiteFrame>
  )
}

function RealtimeList({ items, lang: L }: { items: PublicArticle[]; lang?: 'ko' | 'en' }) {
  return (
    <ul className="divide-y divide-rule">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/news/${a.id}`} className="group flex gap-3 py-3">
            <div className="min-w-0 flex-1">
              <time dateTime={a.published_at ?? undefined} className="text-[12px] font-semibold text-brand tabular-nums">
                {formatShort(a.published_at, L)}
              </time>
              <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.45] group-hover:underline underline-offset-2">{a.title}</p>
            </div>
            {a.thumbnail_url && <Thumb sizes="120px" src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[84px] flex-shrink-0" />}
          </Link>
        </li>
      ))}
    </ul>
  )
}
