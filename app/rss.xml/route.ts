import { headers } from 'next/headers'
import { currentSite, getFeedArticles, siteBaseUrl } from '@/lib/public-data'
import { xml, xmlResponse } from '@/lib/xml'

export const dynamic = 'force-dynamic'

// RSS: 최근 기사 50건 (포털·뉴스 앱·구독용)
export async function GET() {
  const site = await currentSite()
  const base = siteBaseUrl(site, headers().get('host'))
  const articles = await getFeedArticles(site, 50)
  const items = articles.map((a) => `<item>
  <title>${xml(a.title)}</title>
  <link>${base}/news/${a.id}</link>
  <guid isPermaLink="true">${base}/news/${a.id}</guid>
  <pubDate>${new Date(a.published_at ?? Date.now()).toUTCString()}</pubDate>
  ${a.author_name ? `<author>${xml(`${a.author_name} 기자`)}</author>` : ''}
  ${a.category ? `<category>${xml(a.category.name)}</category>` : ''}
  <description>${xml(a.excerpt ?? '')}</description>
  ${a.thumbnail_url ? `<enclosure url="${xml(a.thumbnail_url)}" type="image/jpeg" length="0" />` : ''}
</item>`)
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${xml(site.name)}</title>
  <link>${base}/</link>
  <description>${xml(site.description)}</description>
  <language>ko</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join('\n')}
</channel>
</rss>
`, 'application/rss+xml')
}
