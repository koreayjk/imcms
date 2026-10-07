import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { currentSite, getArticleData, legacyArticleId } from '@/lib/public-data'
import { findSection, siteIcon } from '@/lib/sites'
import SiteFrame from '@/components/site/SiteFrame'
import { sanitizeBody } from '@/lib/article-html'
import ViewCounter from './ViewCounter'
import AdArea from '@/components/site/AdArea'
import ArticleMain from '@/components/site/ArticleMain'
import ArticleAside from '@/components/site/ArticleAside'

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }

// 다른 프로그램에서 쓰던 옛 기사 주소 (ND소프트 /news/articleView.html?idxno=123, 미디어온 /news/article.html?no=123 등)
const LEGACY_PAGE = /\.(html?|php|asp)$/i
const LEGACY_KEYS = ['idxno', 'no', 'idx', 'aid', 'article_id', 'num', 'uid', 'id']
function legacyNumber(sp: Record<string, string | string[] | undefined>) {
  for (const k of LEGACY_KEYS) {
    const v = sp[k]
    const one = Array.isArray(v) ? v[0] : v
    if (one && /^[\w-]{1,64}$/.test(one)) return one
  }
  return null
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  if (LEGACY_PAGE.test(params.id)) return {}
  const site = await currentSite()
  const data = await getArticleData(site, params.id)
  if (!data) return { title: `기사를 찾을 수 없습니다 | ${site.name}` }
  const a = data.article
  const title = a.meta_title || a.title
  const description = a.meta_description || a.excerpt || undefined
  return {
    title: `${title} | ${site.name}`,
    description,
    icons: { icon: siteIcon(site) },
    ...(site.indexable ? { robots: { index: true, follow: true } } : {}),
    alternates: data.source?.url ? { canonical: data.source.url } : undefined,
    openGraph: {
      title,
      description,
      siteName: site.name,
      type: 'article',
      // 기사 사진이 없으면 매체 대표 이미지
      images: a.thumbnail_url ? [a.thumbnail_url] : site.ogImage ? [{ url: site.ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: { card: a.thumbnail_url || site.ogImage ? 'summary_large_image' : 'summary' },
  }
}

export default async function ArticlePage(props: Props) {
  const params = await props.params
  const site = await currentSite()
  // 옛 기사 주소로 들어오면 옮겨 온 새 기사로 (기사 목록 같은 옛 주소는 첫 화면으로)
  if (LEGACY_PAGE.test(params.id)) {
    const legacy = legacyNumber(await props.searchParams)
    const id = legacy ? await legacyArticleId(site, legacy) : null
    if (id) permanentRedirect(`/news/${id}`)
    if (/list/i.test(params.id)) permanentRedirect('/')
    notFound()
  }
  const data = await getArticleData(site, params.id)
  if (!data) notFound()
  const { article: a, related, relatedLinks, mostViewed, latest, source } = data
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
          relatedLinks={relatedLinks}
          bottomAd={<AdArea site={site} slot="article_bottom" className="mt-9" />}
        />
        <ArticleAside site={site} mostViewed={mostViewed} latest={latest} />
      </div>
    </SiteFrame>
  )
}
