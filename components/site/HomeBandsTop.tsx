import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import type { SiteConfig } from '@/lib/sites'
import { formatDate, formatShort } from '@/lib/format'
import { siteText } from '@/lib/site-text'
import Thumb from './Thumb'
import HeroSlider from './HeroSlider'
import { CategoryLabel } from './items'

// 한국 스타일 3 · 섹션 띠형의 첫 화면: PC는 글이 왼쪽, 큰 사진이 오른쪽인 가로 헤드라인 / 휴대폰은 사진 위, 글 아래 + 작은 기사 4칸
//   그 아래는 섹션별 띠(HomeBands). 한국 스타일 1(3단 톱)과 첫 화면부터 다르게 보이도록 따로 만든다
export default function HomeBandsTop({ site, headline, items, slides, heroSeconds }: { site: SiteConfig; headline: PublicArticle; items: PublicArticle[]; slides?: PublicArticle[]; heroSeconds?: number }) {
  const L = site.lang
  const t = siteText(site)
  return (
    <section aria-label={t.topStories} className="border-b border-rule py-5 lg:py-7">
      {(() => {
        const hero = (h: PublicArticle) => (
          <Link href={`/news/${h.id}`} className="headline-link group grid grid-cols-1 items-stretch overflow-hidden rounded-2xl bg-soft lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="hs-text flex flex-col justify-center px-5 py-5 lg:px-10 lg:py-8">
              <CategoryLabel article={h} />
              <h2 className="headline-text mt-2 line-clamp-4 text-balance text-[23px] font-extrabold leading-[1.3] lg:text-[34px] tracking-[-0.035em] text-body">{h.title}</h2>
              {h.excerpt && <p className="mt-3 line-clamp-3 text-[15.5px] lg:mt-4 leading-[1.65] text-sub">{h.excerpt}</p>}
              <p className="mt-5 text-[12.5px] text-[#8A918C]">{h.author_name ? `${h.author_name} · ` : ''}{formatDate(h.published_at, L, site.timeZone)}</p>
            </div>
            <div className="hs-photo order-first overflow-hidden lg:order-last"><Thumb sizes="(max-width: 1023px) 100vw, 720px" src={h.thumbnail_url} alt={h.title} ratio="16 / 10" /></div>
          </Link>
        )
        return slides && slides.length > 1
          ? <HeroSlider seconds={heroSeconds ?? 5} label={t.topStories} brand={site.colors.brand}>{slides.map((h) => <div key={h.id}>{hero(h)}</div>)}</HeroSlider>
          : hero(headline)
      })()}
      {items.length > 0 && (
        <ul className="mt-5 grid grid-cols-2 gap-4 lg:mt-6 lg:grid-cols-4 lg:gap-6">
          {items.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link href={`/news/${a.id}`} className="headline-link group block">
                <Thumb sizes="300px" src={a.thumbnail_url} alt="" ratio="3 / 2" />
                <CategoryLabel article={a} className="mt-2.5" />
                <h3 className="headline-text mt-0.5 line-clamp-2 text-[16px] font-bold leading-[1.42] tracking-[-0.02em]">{a.title}</h3>
                <time dateTime={a.published_at ?? undefined} className="mt-1 block text-[12px] tabular-nums text-[#8A918C]">{formatShort(a.published_at, L, site.timeZone)}</time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
