import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { currentSite, getArticleData } from '@/lib/public-data'
import { findSection } from '@/lib/sites'
import SiteFrame from '@/components/site/SiteFrame'
import { sanitizeBody } from '@/lib/article-html'
import ViewCounter from './ViewCounter'
import AdArea from '@/components/site/AdArea'
import ArticleMain from '@/components/site/ArticleMain'
import ArticleAside from '@/components/site/ArticleAside'

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
      {!a.id.startsWith('demo-') && <ViewCounter id={a.id} />}
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-7 lg:grid-cols-[1fr_300px] lg:py-10">
        <ArticleMain
          a={a}
          bodyHtml={sanitizeBody(a.body)}
          sectionName={section?.name}
          siteName={site.name}
          source={source}
          related={related}
          bottomAd={<AdArea site={site} slot="article_bottom" className="mt-9" />}
        />
        <ArticleAside site={site} mostViewed={mostViewed} latest={latest} />
      </div>
    </SiteFrame>
  )
}
