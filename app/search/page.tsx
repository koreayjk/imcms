import type { Metadata } from 'next'
import { currentSite, searchArticles } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import ArticleRow from '@/components/site/ArticleRow'

type Props = { searchParams: { q?: string } }

export function generateMetadata(): Metadata {
  const site = currentSite()
  return { title: `기사 검색 | ${site.name}`, icons: { icon: site.logoMark }, robots: { index: false } }
}

export default async function SearchPage({ searchParams }: Props) {
  const site = currentSite()
  const q = (searchParams.q ?? '').slice(0, 100)
  const results = await searchArticles(site, q)

  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[860px] px-4 py-8 lg:py-12">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-brand">기사 검색</h1>
        <form action="/search" className="mt-4 flex border-2 border-brand">
          <label htmlFor="q" className="sr-only">검색어</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="기사 제목으로 검색"
            className="min-w-0 flex-1 px-4 py-3 text-[16px] outline-none"
          />
          <button type="submit" className="bg-brand px-6 text-[15px] font-semibold text-white">검색</button>
        </form>

        {q && (
          <>
            <p className="mb-4 mt-8 border-b-2 border-brand pb-2 text-[13px] text-sub">
              ‘<strong className="text-body">{q}</strong>’ 검색 결과 <strong className="text-body tabular-nums">{results.length}</strong>건
            </p>
            {results.length ? (
              <ul className="divide-y divide-rule">
                {results.map((a) => <ArticleRow key={a.id} article={a} showCategory />)}
              </ul>
            ) : (
              <p className="py-16 text-center text-[15px] text-sub">검색 결과가 없습니다. 다른 검색어로 찾아보세요.</p>
            )}
          </>
        )}
      </div>
    </SiteFrame>
  )
}
