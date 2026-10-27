import type { Metadata } from 'next'
import { currentSite, searchArticles } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import ArticleRow from '@/components/site/ArticleRow'
import { siteIcon } from '@/lib/sites'
import { siteText } from '@/lib/site-text'

type Props = { searchParams: Promise<{ q?: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  const t = siteText(site)
  return { title: `${t.searchArticles} | ${site.name}`, icons: { icon: siteIcon(site) }, robots: { index: false } }
}

export default async function SearchPage(props: Props) {
  const searchParams = await props.searchParams
  const site = await currentSite()
  const t = siteText(site)
  const q = (searchParams.q ?? '').slice(0, 100)
  const results = await searchArticles(site, q)

  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[860px] px-4 py-8 lg:py-12">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-brand">{t.searchArticles}</h1>
        <form action="/search" className="mt-4 flex border-2 border-brand">
          <label htmlFor="q" className="sr-only">{t.searchLabel}</label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder={t.searchHint}
            className="min-w-0 flex-1 px-4 py-3 text-[16px] outline-none"
          />
          <button type="submit" className="bg-brand px-6 text-[15px] font-semibold text-white">{t.search}</button>
        </form>

        {q && (
          <>
            <p className="mb-4 mt-8 border-b-2 border-brand pb-2 text-[13px] text-sub">
              {t.searchResults(q, results.length)}
            </p>
            {results.length ? (
              <ul className="divide-y divide-rule">
                {results.map((a) => <ArticleRow key={a.id} article={a} showCategory lang={site.lang} tz={site.timeZone} />)}
              </ul>
            ) : (
              <p className="py-16 text-center text-[15px] text-sub">{t.searchNone}</p>
            )}
          </>
        )}
      </div>
    </SiteFrame>
  )
}
