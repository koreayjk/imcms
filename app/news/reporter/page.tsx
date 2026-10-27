import AdArea from '@/components/site/AdArea'
import Link from 'next/link'
import type { Metadata } from 'next'
import { currentSite, getAuthorProfile, getReporterArticles, REPORTER_PAGE_SIZE } from '@/lib/public-data'
import { reporterHref } from '@/lib/reporter'
import SiteFrame from '@/components/site/SiteFrame'
import MostViewed from '@/components/site/MostViewed'
import ArticleRow from '@/components/site/ArticleRow'
import { siteIcon } from '@/lib/sites'
import { siteText } from '@/lib/site-text'

type Props = { searchParams: Promise<{ name?: string; page?: string }> }

const nameOf = (sp: { name?: string }) => (sp.name ?? '').trim().slice(0, 40)

export async function generateMetadata(props: Props): Promise<Metadata> {
  const site = await currentSite()
  const t = siteText(site)
  const name = nameOf(await props.searchParams)
  return {
    title: `${t.reporterCount(name)} | ${site.name}`,
    description: name ? `${site.name} — ${t.reporterCount(name)}` : site.description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
  }
}

// 기자별 기사: 기사 아래 '다른기사 보기'에서 온다
export default async function ReporterPage(props: Props) {
  const searchParams = await props.searchParams
  const site = await currentSite()
  const t = siteText(site)
  const name = nameOf(searchParams)
  const page = Math.max(1, Number(searchParams.page) || 1)
  const [{ articles, total, mostViewed }, author] = await Promise.all([
    getReporterArticles(site, name, page),
    site.lang === 'en' ? getAuthorProfile(site, name) : Promise.resolve(null),
  ])
  const pages = Math.max(1, Math.ceil(total / REPORTER_PAGE_SIZE))
  const href = (p: number) => `${reporterHref(name)}${p > 1 ? `&page=${p}` : ''}`
  // 페이지 번호는 지금 페이지 앞뒤로만 (기사가 많아지면 번호가 너무 길어진다)
  const first = Math.max(1, Math.min(page - 4, pages - 9))
  const nums = Array.from({ length: Math.min(10, pages) }, (_, i) => first + i)

  return (
    <SiteFrame site={site}>
      {site.lang === 'en' ? (
        <div className="mx-auto max-w-[1200px] px-4 pt-6">
          <nav className="text-[12px] uppercase tracking-wide text-sub" aria-label={t.breadcrumb}>
            <Link href="/" className="text-brand hover:underline">{t.home}</Link>
            <span className="mx-1.5">\</span>
            <span>Staff members</span>
            <span className="mx-1.5">\</span>
            <span>{name}</span>
          </nav>
          <section aria-label="Author profile" className="mt-4 border border-rule bg-soft p-5 md:p-7">
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-gold-ink">Author profile</p>
            <div className="mt-4 flex flex-col gap-6 md:flex-row">
              {author?.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.photo} alt={name} className="h-[220px] w-[160px] shrink-0 object-cover" />
              ) : (
                <span aria-hidden className="grid h-[160px] w-[160px] shrink-0 place-items-center bg-brand text-[56px] font-bold text-white">{name.charAt(0)}</span>
              )}
              <div className="min-w-0">
                <h1 className="font-serif text-[34px] font-extrabold leading-tight tracking-[-0.02em] text-body">{name || t.reporterTitle(name)}</h1>
                {author?.email && <p className="mt-1 text-[14px] text-sub"><a href={`mailto:${author.email}`} className="hover:text-brand">{author.email}</a></p>}
                {author?.bio && (
                  <div className="mt-4 space-y-2 font-serif text-[16px] leading-[1.75] text-body">
                    {author.bio.split(/\n+/).map((para, i) => <p key={i}>{para}</p>)}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
      <div className="border-b border-rule bg-soft">
        <div className="mx-auto max-w-[1200px] px-4 py-6 lg:py-8">
          <nav className="text-[12px] text-sub" aria-label={t.breadcrumb}>
            <Link href="/" className="hover:text-brand">{t.home}</Link>
            <span className="mx-1.5">›</span>
            <span>{t.byReporter}</span>
          </nav>
          <div className="mt-2 flex items-center gap-3">
            {name && (
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-[18px] font-bold text-white">{name.charAt(0)}</span>
            )}
            <h1 className="text-[24px] font-extrabold tracking-[-0.03em] text-brand lg:text-[28px]">{t.reporterTitle(name)}</h1>
          </div>
        </div>
      </div>

      )}

      <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div>
          <p className="mb-4 border-b-2 border-brand pb-2 text-[13px] text-sub">
            {t.reporterCount(name)} · {t.total(total)}
          </p>
          {articles.length ? (
            <ul className="divide-y divide-rule">
              {articles.map((a) => <ArticleRow key={a.id} article={a} lang={site.lang} tz={site.timeZone} />)}
            </ul>
          ) : (
            <p className="py-20 text-center text-[15px] text-sub">{t.reporterNone(name)}</p>
          )}

          {pages > 1 && (
            <nav className="mt-8 flex flex-wrap justify-center gap-1" aria-label={t.pages}>
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
        </div>

        <aside className="space-y-10">
          <MostViewed items={mostViewed} lang={site.lang} />
          <AdArea site={site} slot="sidebar" className="mx-auto max-w-[300px]" />
        </aside>
      </div>
    </SiteFrame>
  )
}
