import AdArea from '@/components/site/AdArea'
import Link from 'next/link'
import type { Metadata } from 'next'
import { currentSite, getReporterArticles, REPORTER_PAGE_SIZE } from '@/lib/public-data'
import { reporterHref } from '@/lib/reporter'
import SiteFrame from '@/components/site/SiteFrame'
import MostViewed from '@/components/site/MostViewed'
import ArticleRow from '@/components/site/ArticleRow'
import { siteIcon } from '@/lib/sites'

type Props = { searchParams: { name?: string; page?: string } }

const nameOf = (p: Props) => (p.searchParams.name ?? '').trim().slice(0, 40)

export async function generateMetadata(props: Props): Promise<Metadata> {
  const site = await currentSite()
  const name = nameOf(props)
  return {
    title: `${name ? `${name} 기자` : '기자'} 기사 | ${site.name}`,
    description: name ? `${site.name} ${name} 기자가 쓴 기사` : site.description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

// 기자별 기사: 기사 아래 '다른기사 보기'에서 온다
export default async function ReporterPage(props: Props) {
  const { searchParams } = props
  const site = await currentSite()
  const name = nameOf(props)
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { articles, total, mostViewed } = await getReporterArticles(site, name, page)
  const pages = Math.max(1, Math.ceil(total / REPORTER_PAGE_SIZE))
  const href = (p: number) => `${reporterHref(name)}${p > 1 ? `&page=${p}` : ''}`
  // 페이지 번호는 지금 페이지 앞뒤로만 (기사가 많아지면 번호가 너무 길어진다)
  const first = Math.max(1, Math.min(page - 4, pages - 9))
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => first + i)

  return (
    <SiteFrame site={site}>
      <div className="border-b border-rule bg-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
          <nav className="text-[12px] text-sub" aria-label="현재 위치">
            <Link href="/" className="hover:text-brand">홈</Link>
            <span className="mx-1.5">›</span>
            <span>기자별 기사</span>
          </nav>
          <div className="mt-2 flex items-center gap-3">
            {name && (
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-[18px] font-bold text-white">{name.charAt(0)}</span>
            )}
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-brand lg:text-[28px]">{name ? `${name} 기자` : '기자별 기사'}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-8 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="mb-4 border-b-2 border-brand pb-2 text-[13px] text-sub">
            {name ? `${name} 기자가 쓴 기사` : '기사'} <strong className="font-semibold text-body tabular-nums">{total.toLocaleString()}</strong>건
          </p>
          {articles.length ? (
            <ul className="divide-y divide-rule">
              {articles.map((a) => <ArticleRow key={a.id} article={a} />)}
            </ul>
          ) : (
            <p className="py-20 text-center text-[15px] text-sub">{name ? '이 기자 이름으로 발행된 기사가 없습니다.' : '기자 이름이 없습니다.'}</p>
          )}

          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap justify-center gap-1" aria-label="페이지">
              {page > 1 && <Link href={href(page - 1)} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">이전</Link>}
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
              {page < pages && <Link href={href(page + 1)} className="grid h-9 place-items-center border border-rule px-3 text-[14px] text-sub hover:border-brand hover:text-brand">다음</Link>}
            </nav>
          )}
        </div>

        <aside className="space-y-10">
          <MostViewed items={mostViewed} />
          <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
        </aside>
      </div>
    </SiteFrame>
  )
}
