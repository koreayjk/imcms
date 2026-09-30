import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { currentSite, getArticleData } from '@/lib/public-data'
import { findSection } from '@/lib/sites'
import { formatDateTime, formatShort } from '@/lib/format'
import SiteFrame from '@/components/site/SiteFrame'
import SectionHeading from '@/components/site/SectionHeading'
import MostViewed from '@/components/site/MostViewed'
import Thumb from '@/components/site/Thumb'
import { sanitizeBody } from '@/lib/article-html'
import ShareButton from './ShareButton'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await currentSite()
  const data = await getArticleData(site, params.id)
  if (!data) return { title: `기사를 찾을 수 없습니다 | ${site.name}` }
  const a = data.article
  const title = a.meta_title || a.title
  const description = a.meta_description || a.excerpt || undefined
  return {
    title: `${title} | ${site.name}`,
    description,
    icons: { icon: site.logoMark },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
    alternates: data.source?.url ? { canonical: data.source.url } : undefined,
    openGraph: {
      title,
      description,
      siteName: site.name,
      type: 'article',
      images: a.thumbnail_url ? [a.thumbnail_url] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const site = await currentSite()
  const data = await getArticleData(site, params.id)
  if (!data) notFound()
  const { article: a, related, mostViewed, latest, source } = data
  const section = a.category ? findSection(site, a.category.slug) : undefined

  return (
    <SiteFrame site={site} current={a.category?.slug}>
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-7 lg:grid-cols-[1fr_300px] lg:py-10">
        <article className="min-w-0">
          <header className="border-b border-rule pb-5">
            {a.category && (
              <Link href={`/section/${a.category.slug}`} className="text-[13px] font-semibold text-gold-ink hover:underline">
                {section?.name ?? a.category.name}
              </Link>
            )}
            <h1 className="mt-2 text-balance text-[25px] font-extrabold leading-[1.35] tracking-[-0.035em] text-body lg:text-[34px]">
              {a.title}
            </h1>
            {a.excerpt && (
              <p className="mt-4 whitespace-pre-line border-l-[3px] border-gold pl-4 text-[15.5px] leading-[1.7] text-sub lg:text-[17px]">{a.excerpt}</p>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-sub">
              <p className="tabular-nums">
                {a.author_name && <span className="font-semibold text-body">{a.author_name} 기자</span>}
                <span className="mx-2 text-rule" aria-hidden>|</span>
                <span>입력 {formatDateTime(a.published_at)}</span>
                {a.view_count > 0 && (
                  <>
                    <span className="mx-2 text-rule" aria-hidden>|</span>
                    <span>조회 {a.view_count.toLocaleString()}</span>
                  </>
                )}
              </p>
              <ShareButton title={a.title} />
            </div>
          </header>

          {a.thumbnail_url && !/<img\s/i.test(a.body ?? '') && (
            <figure className="mt-7">
              <img src={a.thumbnail_url} alt={a.title} className="w-full" />
            </figure>
          )}

          <div
            className="article-content mt-7 text-[17px] leading-[1.95] text-body lg:text-[17.5px]"
            dangerouslySetInnerHTML={{ __html: sanitizeBody(a.body) }}
          />

          {a.tags && a.tags.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {a.tags.map((t) => (
                <li key={t}>
                  <Link href={`/search?q=${encodeURIComponent(t)}`} className="block rounded-full bg-soft px-3 py-1 text-[13px] text-sub hover:text-brand">
                    #{t}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 border-y border-rule py-4 text-[13px] text-sub">
            {source ? (
              <>
                이 기사는 <strong className="text-body">{source.outletName}</strong>에서 제공한 기사입니다.
                {source.url && (
                  <a href={source.url} className="ml-2 text-brand underline underline-offset-2">원문 보기</a>
                )}
              </>
            ) : (
              <>저작권자 © {site.name} 무단전재 및 재배포 금지</>
            )}
          </p>

          {related.length > 0 && (
            <section className="mt-10">
              <SectionHeading title={`${section?.name ?? '관련'} 다른 기사`} href={a.category ? `/section/${a.category.slug}` : undefined} />
              <ul className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/news/${r.id}`} className="headline-link group block">
                      <Thumb src={r.thumbnail_url} alt={r.title} ratio="3 / 2" />
                      <p className="headline-text mt-2.5 line-clamp-2 text-[14.5px] font-semibold leading-[1.45]">{r.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="space-y-10">
          <MostViewed items={mostViewed} />
          {latest.length > 0 && (
            <section aria-label="최신 기사">
              <SectionHeading title="최신 기사" as="h3" />
              <ul className="divide-y divide-rule">
                {latest.map((r) => (
                  <li key={r.id}>
                    <Link href={`/news/${r.id}`} className="group block py-3 first:pt-0">
                      <time className="text-[12px] font-semibold text-brand tabular-nums">{formatShort(r.published_at)}</time>
                      <p className="mt-0.5 line-clamp-2 text-[14.5px] leading-[1.45] group-hover:underline underline-offset-2">{r.title}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </SiteFrame>
  )
}
