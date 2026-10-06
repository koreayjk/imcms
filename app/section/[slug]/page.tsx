import AdArea from '@/components/site/AdArea'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { currentSite, getSectionData, SECTION_PAGE_SIZE } from '@/lib/public-data'
import { childSections, findSection, siteIcon } from '@/lib/sites'
import SiteFrame from '@/components/site/SiteFrame'
import MostViewed from '@/components/site/MostViewed'
import ArticleRow from '@/components/site/ArticleRow'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const site = await currentSite()
  const section = findSection(site, params.slug)
  return {
    title: section ? `${section.name} | ${site.name}` : site.name,
    description: section?.description ?? site.description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

export default async function SectionPage(props: Props) {
  const searchParams = await props.searchParams
  const params = await props.params
  const site = await currentSite()
  const section = findSection(site, params.slug)
  if (!section) notFound()

  const page = Math.max(1, Number(searchParams.page) || 1)
  const { articles, total, mostViewed } = await getSectionData(site, section.slug, page)
  const pages = Math.max(1, Math.ceil(total / SECTION_PAGE_SIZE))
  // 2차 메뉴: 상위 섹션이면 자기 아래 메뉴, 2차 메뉴면 같은 상위의 메뉴들
  const parent = section.parent ? findSection(site, section.parent) : undefined
  const head = parent ?? section
  const subs = childSections(site, head.slug)

  return (
    <SiteFrame site={site} current={section.slug}>
      <div className="border-b border-rule bg-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
          <nav className="text-[12px] text-sub" aria-label="현재 위치">
            <Link href="/" className="hover:text-brand">홈</Link>
            {parent && (
              <>
                <span className="mx-1.5">›</span>
                <Link href={`/section/${parent.slug}`} className="hover:text-brand">{parent.name}</Link>
              </>
            )}
            <span className="mx-1.5">›</span>
            <span>{section.name}</span>
          </nav>
          <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.03em] text-brand lg:text-[28px]">{section.name}</h1>
          {section.description && <p className="mt-1 text-[14px] text-sub">{section.description}</p>}
          {subs.length > 0 && (
            <nav aria-label={`${head.name} 하위 메뉴`} className="no-scrollbar -mx-4 mt-4 overflow-x-auto px-4">
              <ul className="flex gap-2">
                {[{ slug: head.slug, name: '전체' }, ...subs].map((k) => {
                  const on = k.slug === section.slug
                  return (
                    <li key={k.slug}>
                      <Link
                        href={`/section/${k.slug}`}
                        aria-current={on ? 'page' : undefined}
                        className={`block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13.5px] ${on ? 'border-brand bg-brand font-semibold text-white' : 'border-rule bg-white text-body hover:border-brand hover:text-brand'}`}
                      >
                        {k.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-8 lg:grid-cols-[1fr_300px]">
        <div>
          <p className="mb-4 border-b-2 border-brand pb-2 text-[13px] text-sub">
            전체 <strong className="font-semibold text-body tabular-nums">{total.toLocaleString()}</strong>건
          </p>
          {articles.length ? (
            <ul className="divide-y divide-rule">
              {articles.map((a) => <ArticleRow key={a.id} article={a} />)}
            </ul>
          ) : (
            <p className="py-20 text-center text-[15px] text-sub">아직 발행된 기사가 없습니다.</p>
          )}

          {pages > 1 && (
            <nav className="mt-8 flex justify-center gap-1" aria-label="페이지">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/section/${section.slug}${p > 1 ? `?page=${p}` : ''}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={`grid h-9 min-w-9 place-items-center border px-2 text-[14px] tabular-nums ${
                    p === page ? 'border-brand bg-brand font-semibold text-white' : 'border-rule text-sub hover:border-brand hover:text-brand'
                  }`}
                >
                  {p}
                </Link>
              ))}
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
