import AdArea from '@/components/site/AdArea'
import Link from 'next/link'
import type { Metadata } from 'next'
import { currentSite, getSectionData, SECTION_PAGE_SIZE } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import MostViewed from '@/components/site/MostViewed'
import ArticleRow from '@/components/site/ArticleRow'
import { ALL_NEWS } from '@/components/site/SiteHeader'
import { siteIcon } from '@/lib/sites'
import { siteText } from '@/lib/site-text'

type Props = { searchParams: Promise<{ page?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  const t = siteText(site)
  return {
    title: `${t.allNews} | ${site.name}`,
    description: site.description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

// 전체기사: 모든 섹션의 기사를 최신순으로
export default async function AllNewsPage(props: Props) {
  const searchParams = await props.searchParams
  const site = await currentSite()
  const t = siteText(site)
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { articles, total, mostViewed } = await getSectionData(site, null, page)
  const pages = Math.max(1, Math.ceil(total / SECTION_PAGE_SIZE))
  // 페이지 번호는 지금 페이지 앞뒤로만 (기사가 많아지면 번호가 너무 길어진다)
  const first = Math.max(1, Math.min(page - 4, pages - 9))
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => first + i)

  return (
    <SiteFrame site={site} current={ALL_NEWS}>
      <div className="border-b border-rule bg-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
          <nav className="text-[12px] text-sub" aria-label={t.breadcrumb}>
            <Link href="/" className="hover:text-brand">{t.home}</Link>
            <span className="mx-1.5">›</span>
            <span>{t.allNews}</span>
          </nav>
          <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.03em] text-brand lg:text-[28px]">{t.allNews}</h1>
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mb-4 border-b-2 border-brand pb-2 text-[13px] text-sub">
            {t.total(total)}
          </p>
          {articles.length ? (
            <ul className="divide-y divide-rule">
              {articles.map((a) => <ArticleRow key={a.id} article={a} lang={site.lang} />)}
            </ul>
          ) : (
            <p className="py-20 text-center text-[15px] text-sub">{t.noArticles}</p>
          )}

          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap justify-center gap-1" aria-label={t.pages}>
              {page > 1 && <Link href={`/news${page > 2 ? `?page=${page - 1}` : ''}`} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">{t.prev}</Link>}
              {nums.map((p) => (
                <Link
                  key={p}
                  href={`/news${p > 1 ? `?page=${p}` : ''}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={`grid h-9 min-w-9 place-items-center border px-2 text-[14px] tabular-nums ${
                    p === page ? 'border-brand bg-brand font-semibold text-white' : 'border-rule text-sub hover:border-brand hover:text-brand'
                  }`}
                >
                  {p}
                </Link>
              ))}
              {page < pages && <Link href={`/news?page=${page + 1}`} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">{t.next}</Link>}
            </nav>
          )}
        </div>

        <aside className="space-y-10">
          <MostViewed items={mostViewed} lang={site.lang} />
          <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
        </aside>
      </div>
    </SiteFrame>
  )
}
