import Link from 'next/link'
import type { ReactNode } from 'react'
import type { PublicArticle } from '@/lib/public-data'
import { childSections, findSection, type HomeBand, type SiteConfig } from '@/lib/sites'
import { formatShort } from '@/lib/format'
import SectionHeading from './SectionHeading'
import MostViewed from './MostViewed'
import Thumb from './Thumb'
import { CategoryLabel } from './items'

// 홈 '섹션 띠' 배치 (홈페이지 설정 homeLayout = 'bands').
//   설정한 순서대로 1차 섹션을 띠처럼 쌓는다. 기사가 없는 띠는 숨기고, SHEMA(feature)·SHOP 띠는 소개만이라도 보여준다
//   brief: 시간순 속보 + 많이 본 뉴스 / news: 큰 기사 + 목록 / feature: 대표색 띠(교육 브랜드) / grid: 사진 4칸 / video: 어두운 영상 띠 / shop: 상품 분류 타일

type Props = {
  site: SiteConfig
  bands: HomeBand[]
  bySection: Record<string, PublicArticle[]>
  mostViewed: PublicArticle[]
  used: Set<string>
  ad?: ReactNode
  sidebarAd?: ReactNode
}

export default function HomeBands({ site, bands, bySection, mostViewed, used, ad, sidebarAd }: Props) {
  return (
    <>
      {bands.map((b, i) => {
        const section = findSection(site, b.slug)
        if (!section) return null
        // 위에서 이미 보여준 기사는 빼되, 띠가 비면 그대로 쓴다
        const all = bySection[b.slug] ?? []
        const fresh = all.filter((a) => !used.has(a.id))
        const items = fresh.length >= Math.min(3, all.length) ? fresh : all
        const title = b.title || section.name
        const subs = childSections(site, b.slug)
        const props = { site, band: b, title, href: `/section/${b.slug}`, items, subs }
        const node =
          b.style === 'brief' ? <BriefBand {...props} mostViewed={mostViewed} sidebarAd={sidebarAd} />
          : b.style === 'feature' ? <FeatureBand {...props} />
          : b.style === 'grid' ? <GridBand {...props} />
          : b.style === 'video' ? <VideoBand {...props} />
          : b.style === 'shop' ? <ShopBand {...props} />
          : <NewsBand {...props} />
        if (!node) return null
        return (
          <div key={b.slug}>
            {node}
            {/* 세 번째 띠 뒤에 홈 중간 광고 */}
            {i === 2 && ad}
          </div>
        )
      })}
    </>
  )
}

type BandProps = { site: SiteConfig; band: HomeBand; title: string; href: string; items: PublicArticle[]; subs: { slug: string; name: string }[] }

function SubLinks({ subs, light = false }: { subs: BandProps['subs']; light?: boolean }) {
  if (!subs.length) return null
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
      {subs.map((s) => (
        <li key={s.slug}>
          <Link href={`/section/${s.slug}`} className={light ? 'text-white/70 hover:text-white' : 'text-sub hover:text-brand'}>{s.name}</Link>
        </li>
      ))}
    </ul>
  )
}

function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-[1200px] px-4 py-9 ${className}`}>{children}</section>
}

// ② 시간순 속보 + 많이 본 뉴스
function BriefBand({ title, href, items, subs, mostViewed, sidebarAd }: BandProps & { mostViewed: PublicArticle[]; sidebarAd?: ReactNode }) {
  if (!items.length) return null
  return (
    <Wrap className="grid gap-10 lg:grid-cols-[1fr_300px]">
      <div>
        <SectionHeading title={title} href={href} />
        <div className="mb-3"><SubLinks subs={subs} /></div>
        <ul className="divide-y divide-rule">
          {items.slice(0, 8).map((a) => (
            <li key={a.id}>
              <Link href={`/news/${a.id}`} className="headline-link group grid grid-cols-[56px_1fr] gap-3 py-3 sm:grid-cols-[64px_1fr_auto]">
                <time dateTime={a.published_at ?? undefined} className="pt-0.5 text-[12.5px] font-semibold tabular-nums text-brand">{formatShort(a.published_at)}</time>
                <div className="min-w-0">
                  <p className="headline-text line-clamp-1 text-[16px] font-semibold leading-[1.45] tracking-[-0.02em]">{a.title}</p>
                  {a.excerpt && <p className="mt-0.5 line-clamp-1 text-[13px] text-sub">{a.excerpt}</p>}
                </div>
                <CategoryLabel article={a} className="hidden self-center sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <aside className="space-y-9">
        <MostViewed items={mostViewed} />
        {sidebarAd}
      </aside>
    </Wrap>
  )
}

// ③⑤ 큰 기사 하나 + 목록
function NewsBand({ title, href, items, subs }: BandProps) {
  if (!items.length) return null
  const [lead, ...rest] = items
  return (
    <Wrap className="border-t border-rule">
      <SectionHeading title={title} href={href} />
      <div className="mb-4"><SubLinks subs={subs} /></div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <Link href={`/news/${lead.id}`} className="headline-link group block">
          <Thumb src={lead.thumbnail_url} alt={lead.title} ratio="16 / 10" />
          <CategoryLabel article={lead} className="mt-3" />
          <h3 className="headline-text mt-1 line-clamp-2 text-[22px] font-extrabold leading-[1.35] tracking-[-0.03em]">{lead.title}</h3>
          {lead.excerpt && <p className="mt-2 line-clamp-2 text-[14px] leading-[1.6] text-sub">{lead.excerpt}</p>}
        </Link>
        <ul className="divide-y divide-rule">
          {rest.slice(0, 4).map((a) => (
            <li key={a.id} className="py-3.5 first:pt-0">
              <Link href={`/news/${a.id}`} className="headline-link group flex gap-4">
                <div className="min-w-0 flex-1">
                  <CategoryLabel article={a} />
                  <p className="headline-text mt-0.5 line-clamp-2 text-[16px] font-bold leading-[1.42] tracking-[-0.02em]">{a.title}</p>
                  <time dateTime={a.published_at ?? undefined} className="mt-1 block text-[12px] tabular-nums text-[#8A918C]">{formatShort(a.published_at)}</time>
                </div>
                {a.thumbnail_url && <Thumb src={a.thumbnail_url} alt="" ratio="4 / 3" className="w-[112px] flex-shrink-0" />}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Wrap>
  )
}

// ④ 교육 브랜드 띠 (대표색 바탕)
function FeatureBand({ band, title, href, items, subs }: BandProps) {
  return (
    <section className="bg-brand-dark text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-11">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href={href} className="font-serif text-[40px] font-bold leading-none tracking-[0.06em] text-white hover:text-gold lg:text-[48px]">{title}</Link>
            {band.tagline && <p className="mt-3 text-[16px] text-white/85 lg:text-[17px]">{band.tagline}</p>}
          </div>
          <SubLinks subs={subs} light />
        </div>
        <div className="mt-6 h-px bg-white/15" />
        {items.length ? (
          <ul className="mt-7 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {items.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="group block">
                  <Thumb src={a.thumbnail_url} alt={a.title} ratio="3 / 2" />
                  <p className="mt-3 text-[12px] font-semibold text-gold">{a.category?.name}</p>
                  <p className="mt-1 line-clamp-2 text-[16px] font-bold leading-[1.45] group-hover:underline group-hover:underline-offset-4">{a.title}</p>
                  {a.excerpt && <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.6] text-white/70">{a.excerpt}</p>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-7 text-[15px] text-white/75">곧 연재가 시작됩니다.</p>
        )}
      </div>
    </section>
  )
}

// ⑦ 사진 4칸
function GridBand({ title, href, items, subs }: BandProps) {
  if (!items.length) return null
  return (
    <Wrap className="border-t border-rule">
      <SectionHeading title={title} href={href} />
      <div className="mb-4"><SubLinks subs={subs} /></div>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-4">
        {items.slice(0, 4).map((a) => (
          <li key={a.id}>
            <Link href={`/news/${a.id}`} className="headline-link group block">
              <Thumb src={a.thumbnail_url} alt={a.title} ratio="4 / 3" />
              <CategoryLabel article={a} className="mt-2.5" />
              <p className="headline-text mt-0.5 line-clamp-2 text-[15px] font-bold leading-[1.45]">{a.title}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Wrap>
  )
}

// ⑥ 영상 (어두운 바탕, 재생 표시)
function VideoBand({ title, href, items, subs }: BandProps) {
  if (!items.length) return null
  return (
    <section className="bg-[#111418] text-white">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
          <Link href={href} className="text-[20px] font-bold tracking-[-0.02em] hover:text-gold">{title}</Link>
          <SubLinks subs={subs} light />
        </div>
        <ul className="grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {items.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link href={`/news/${a.id}`} className="group block">
                <div className="relative">
                  <Thumb src={a.thumbnail_url} alt={a.title} ratio="16 / 9" />
                  <span aria-hidden className="absolute inset-0 grid place-items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black/55 ring-2 ring-white/80 transition group-hover:bg-brand">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </span>
                </div>
                <p className="mt-2.5 line-clamp-2 text-[15px] font-semibold leading-[1.45] group-hover:underline group-hover:underline-offset-4">{a.title}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ⑧ SHOP: 분류 타일 (쇼핑몰 주소가 있으면 그리로, 없으면 '준비 중')
function ShopBand({ site, band, title, href, items, subs }: BandProps) {
  const shop = site.shopUrl
  const tiles = subs.length ? subs : [{ slug: band.slug, name: title }]
  return (
    <section className="border-t-[3px] border-gold bg-soft">
      <div className="mx-auto max-w-[1200px] px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-serif text-[12px] tracking-[0.28em] text-gold-ink">{site.nameEn} STORE</p>
            <Link href={shop ?? href} className="mt-1 block text-[26px] font-extrabold tracking-[-0.03em] text-brand hover:underline underline-offset-4">{title}</Link>
            {band.tagline && <p className="mt-1 text-[14px] text-sub">{band.tagline}</p>}
          </div>
          {shop
            ? <a href={shop} className="rounded-full bg-brand px-5 py-2 text-[14px] font-bold text-white hover:bg-brand-dark">쇼핑몰 바로가기</a>
            : <span className="rounded-full border border-rule bg-white px-4 py-1.5 text-[13px] text-sub">오픈 준비 중</span>}
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((t) => (
            <li key={t.slug}>
              <Link href={shop ?? `/section/${t.slug}`} className="flex h-[92px] flex-col justify-between rounded-lg border border-rule bg-white p-4 transition hover:border-brand hover:shadow-sm">
                <span className="text-[15.5px] font-bold text-body">{t.name}</span>
                <span className="text-[12px] text-gold-ink">둘러보기 →</span>
              </Link>
            </li>
          ))}
        </ul>
        {items.length > 0 && (
          <ul className="mt-6 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="line-clamp-1 text-[14.5px] text-body hover:text-brand">· {a.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
