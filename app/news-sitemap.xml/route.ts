import { headers } from 'next/headers'
import { currentSite, getFeedArticles, siteBaseUrl } from '@/lib/public-data'
import { xml, xmlResponse } from '@/lib/xml'

export const dynamic = 'force-dynamic'

// 뉴스 사이트맵 (구글 뉴스 형식): 최근 48시간에 공개된 기사
export async function GET() {
  const site = await currentSite()
  const base = siteBaseUrl(site, (await headers()).get('host'))
  const articles = await getFeedArticles(site, 1000, 48)
  const items = articles.map((a) => `<url>
  <loc>${base}/news/${a.id}</loc>
  <news:news>
    <news:publication><news:name>${xml(site.name)}</news:name><news:language>ko</news:language></news:publication>
    <news:publication_date>${new Date(a.published_at ?? Date.now()).toISOString()}</news:publication_date>
    <news:title>${xml(a.title)}</news:title>
  </news:news>
</url>`)
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${items.join('\n')}\n</urlset>\n`)
}
