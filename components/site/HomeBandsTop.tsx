import Link from 'next/link'
import type { PublicArticle } from '@/lib/public-data'
import type { SiteConfig } from '@/lib/sites'
import { formatDate, formatShort } from '@/lib/format'
import { siteText } from '@/lib/site-text'
import Thumb from './Thumb'
import { CategoryLabel } from './items'

// 한국 스타일 3 · 섹션 띠형의 첫 화면: PC는 글이 왼쪽, 큰 사진이 오른쪽인 가로 헤드라인 / 휴대폰은 사진 위, 글 아래 + 작은 기사 4칸
//   그 아래는 섹션별 띠(HomeBands). 한국 스타일 1(3단 톱)과 첫 화면부터 다르게 보이도록 따로 만든다
export default function HomeBandsTop({ site, headline, items }: { site: SiteConfig; headline: PublicArticle; items: PublicArticle[] }) {
  const L = site.lang
  const t = siteText(site)
  return (
    <section aria-label={t.topStories} className="border-b border-rule py-5 lg:py-7">
      <Link href={`/news/${headline.id}`} className="headline-link group grid grid-cols-1 items-stretch overflow-hidden rounded-2xl bg-soft lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col justify-center px-5 py-5 lg:px-10 lg:py-8">
          <CategoryLabel article={headline} />
          <h2 className="headline-text mt-2 line-clamp-4 text-balance text-[23px] font-extrabold leading-[1.3] lg:text-[34px] tracking-[-0.035em] text-body">{headline.title}</h2>
          {headline.excerpt && <p className="mt-3 line-clamp-3 text-[15.5px] lg:mt-4 leading-[1.65] text-sub">{headline.excerpt}</p>}
          <p className="mt-5 text-[12.5px] text-[#8A918C]">{headline.author_name ? `${headline.author_name} · ` : ''}{formatDate(headline.published_at, L, site.timeZone)}</p>
        </div>
        <Thumb sizes="(max-width: 1023px) 100vw, 720px" src={headline.thumbnail_url} alt={headline.title} ratio="16 / 10" className="order-first lg:order-last" />
      </Link>
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
