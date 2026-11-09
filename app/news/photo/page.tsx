import AdArea from '@/components/site/AdArea'
import Link from 'next/link'
import type { Metadata } from 'next'
import { currentSite, getPhotoNews, PHOTO_PAGE_SIZE } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import Thumb from '@/components/site/Thumb'
import { ALL_NEWS } from '@/components/site/SiteHeader'
import { siteIcon } from '@/lib/sites'
import { siteText } from '@/lib/site-text'

type Props = { searchParams: Promise<{ page?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  const t = siteText(site)
  return {
    title: `${t.photoNews} | ${site.name}`,
    description: site.description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

// 포토뉴스 모아보기: 홈 포토뉴스 띠의 "더보기"가 여기로 온다. 사진이 있는 기사를 최신순으로 사진 카드로 보여 준다
export default async function PhotoNewsPage(props: Props) {
  const searchParams = await props.searchParams
  const site = await currentSite()
  const t = siteText(site)
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { articles, total } = await getPhotoNews(site, page)
  const pages = Math.max(1, Math.ceil(total / PHOTO_PAGE_SIZE))
  const first = Math.max(1, Math.min(page - 4, pages - 9))
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => first + i)
  const href = (p: number) => `/news/photo${p > 1 ? `?page=${p}` : ''}`

  return (
    <SiteFrame site={site} current={ALL_NEWS}>
      <div className="border-b border-rule bg-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
          <nav className="text-[12px] text-sub" aria-label={t.breadcrumb}>
            <Link href="/" className="hover:text-brand">{t.home}</Link>
            <span className="mx-1.5">›</span>
            <span>{t.photoNews}</span>
          </nav>
          <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.03em] text-brand lg:text-[28px]">{t.photoNews}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <p className="mb-5 border-b-2 border-brand pb-2 text-[13px] text-sub">{t.total(total)}</p>
        {articles.length ? (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {articles.map((a) => (
              <li key={a.id}>
                <Link href={`/news/${a.id}`} className="group block">
                  <Thumb src={a.thumbnail_url} alt={a.title} ratio="3 / 2" sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 280px" className="overflow-hidden rounded" />
                  <p className="mt-3 line-clamp-2 text-[15.5px] font-bold leading-[1.45] group-hover:underline underline-offset-2">{a.title}</p>
                  {(a.excerpt || a.author_name) && (
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-[1.55] text-sub">{[a.author_name, a.excerpt].filter(Boolean).join(' | ')}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-20 text-center text-[15px] text-sub">{t.noArticles}</p>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex flex-wrap justify-center gap-1" aria-label={t.pages}>
            {page > 1 && <Link href={href(page - 1)} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">{t.prev}</Link>}
            {nums.map((p) => (
              <Link
                key={p}
                href={href(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`grid h-9 min-w-9 place-items-center border px-2 text-[14px] tabular-nums ${
                  p === page ? 'border-brand bg-brand font-semibold text-white' : 'border-rule text-sub hover:border-brand hover:text-brand'
                }`}
              >
                {p}
              </Link>
            ))}
            {page < pages && <Link href={href(page + 1)} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">{t.next}</Link>}
          </nav>
        )}

        <AdArea site={site} slot="sidebar" className="mx-auto mt-10 max-w-[300px]" />
      </div>
    </SiteFrame>
  )
}
