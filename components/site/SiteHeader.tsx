import Link from 'next/link'
import { childSections, dividerBefore, topSections, type SiteConfig } from '@/lib/sites'
import { formatToday } from '@/lib/format'
import Logo from './Logo'
import MobileHeader from './MobileHeader'
import { SearchIcon } from './icons'
import { siteText } from '@/lib/site-text'

// 전체기사 메뉴의 current 값 (섹션 slug와 겹치지 않게)
export const ALL_NEWS = '__all'

type Props = { site: SiteConfig; current?: string }

export default function SiteHeader({ site, current }: Props) {
  const mail = `mailto:${site.legal.email}`
  // 광고문의는 홈페이지 양식으로 받아 편집국 '광고문의'에서 확인한다 (매체가 없는 미리보기만 메일)
  const adsHref = site.outletId ? '/inquiry/ads' : `${mail}?subject=${encodeURIComponent(siteText(site).adsSubject)}`
  const tops = topSections(site)
  const t = siteText(site)
  return (
    <header>
      {/* PC */}
      <div className="hidden border-b border-rule bg-soft lg:block">
        <div className="mx-auto flex h-9 max-w-[1200px] items-center justify-between px-4 text-[12px] text-sub">
          <span>{formatToday(site.lang, site.timeZone)}</span>
          <nav className="flex items-center gap-4" aria-label={t.utilNav}>
            <a href={`${mail}?subject=${encodeURIComponent(t.tipSubject)}`} className="hover:text-brand">{t.tip}</a>
            <a href={adsHref} className="hover:text-brand">{t.ads}</a>
            <Link href="/login" className="hover:text-brand">{t.login}</Link>
          </nav>
        </div>
      </div>

      {site.headerBanners ? (
        /* 로고 가운데 + 양옆 기관 배너, 메뉴는 로고 아래 줄 */
        <div className="hidden lg:block">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[300px_1fr_300px] items-center gap-6 px-4 py-5">
            <HeaderBanner item={site.headerBanners.left} />
            <div className="flex justify-center"><Logo site={site} size="lg" /></div>
            <HeaderBanner item={site.headerBanners.right} />
          </div>
          <div className="border-t border-rule">
            <nav className="relative mx-auto max-w-[1200px] px-16" aria-label={t.mainNav}>
              <NavList site={site} current={current} centered />
              <Link href="/search" aria-label={t.searchArticles} className="absolute right-4 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-rule text-body hover:border-brand hover:text-brand"><SearchIcon /></Link>
            </nav>
          </div>
          <div className="h-1 bg-brand" />
        </div>
      ) : site.homeLayout === 'editorial' ? (
        /* 미국 스타일 1: 가운데 큰 제호 + 두 줄 구분선 + 가로 메뉴 */
        <div className="hidden lg:block">
          <div className="mx-auto max-w-[1200px] px-4">
            <div className="flex justify-end pt-3">
              <Link href="/search" aria-label={t.searchArticles} className="grid h-8 w-8 place-items-center rounded-full text-body hover:text-brand"><SearchIcon /></Link>
            </div>
            <div className="flex justify-center pb-5 pt-1"><Logo site={site} size="lg" /></div>
            <nav aria-label={t.mainNav} className="border-y-[3px] border-double border-body py-1">
              <NavList site={site} current={current} centered size="text-[15px]" />
            </nav>
          </div>
        </div>
      ) : (
      <div className="hidden lg:block">
        <div className="mx-auto flex h-[104px] max-w-[1200px] items-center gap-6 px-4">
          <Logo site={site} size="lg" />
          <nav className="flex flex-1 justify-end" aria-label={t.mainNav}>
            <NavList site={site} current={current} />
          </nav>
          <Link
            href="/search"
            aria-label={t.searchArticles}
            className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-rule text-body hover:border-brand hover:text-brand"
          >
            <SearchIcon />
          </Link>
        </div>
        <div className="h-1 bg-brand" />
      </div>
      )}

      {/* 모바일 */}
      <MobileHeader site={site} current={current} />
    </header>
  )
}

// 로고 양옆 기관 배너 (칸은 항상 300px 로 잡아 로고가 가운데에 오게 한다)
function HeaderBanner({ item }: { item?: { name: string; img: string; url?: string } }) {
  if (!item) return <div aria-hidden />
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.img} alt={item.name} className="h-[76px] w-[300px] border border-rule bg-white object-contain" />
  )
  return item.url
    ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="block opacity-100 transition hover:opacity-80">{img}</a>
    : img
}

// 1차 메뉴 (PC). 2차 메뉴는 마우스를 올리거나 키보드로 들어가면 펼친다
function NavList({ site, current, centered = false, size = 'text-[16.5px]' }: { site: SiteConfig; current?: string; centered?: boolean; size?: string }) {
  const tops = topSections(site)
  const t = siteText(site)
  return (
    <ul className={centered ? 'flex flex-wrap items-center justify-center' : 'flex items-center'}>
      <li>
        <Link
          href="/news"
          aria-current={current === ALL_NEWS ? 'page' : undefined}
          className={`relative block whitespace-nowrap px-[12px] py-2 ${size} font-semibold tracking-[-0.02em] transition-colors hover:text-brand ${current === ALL_NEWS ? 'text-brand' : 'text-body'}`}
        >
          {t.allNews}
          {current === ALL_NEWS && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] bg-gold" />}
        </Link>
      </li>
      {tops.map((s, i) => {
        const kids = childSections(site, s.slug)
        const active = current === s.slug || kids.some((k) => k.slug === current)
        const firstSpecialty = dividerBefore(tops, i)
        return (
          <li key={s.slug} className={`group relative ${firstSpecialty ? 'ml-2 border-l border-rule pl-2' : ''}`}>
            <Link
              href={`/section/${s.slug}`}
              aria-current={current === s.slug ? 'page' : undefined}
              className={`relative block whitespace-nowrap px-[12px] py-2 ${size} font-semibold tracking-[-0.02em] transition-colors hover:text-brand ${
                active ? 'text-brand' : 'text-body'
              }`}
            >
              {s.name}
              {active && <span className="absolute inset-x-3 -bottom-0.5 h-[3px] bg-gold" />}
            </Link>
            {/* 2차 메뉴: 마우스를 올리거나 키보드로 들어가면 펼친다 */}
            {kids.length > 0 && (
              <ul className="invisible absolute left-1/2 top-full z-30 min-w-[168px] -translate-x-1/2 border border-rule border-t-[3px] border-t-brand bg-white py-1.5 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                {kids.map((k) => (
                  <li key={k.slug}>
                    <Link
                      href={`/section/${k.slug}`}
                      aria-current={current === k.slug ? 'page' : undefined}
                      className={`block whitespace-nowrap px-4 py-2 text-[14.5px] hover:bg-soft hover:text-brand ${current === k.slug ? 'font-semibold text-brand' : 'text-body'}`}
                    >
                      {k.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>

  )
}
