import { headers } from 'next/headers'
import { currentSite, getFeedArticles, siteBaseUrl } from '@/lib/public-data'
import { xml, xmlResponse } from '@/lib/xml'
import { PRODUCT, PRODUCT_PAGES, appLink, isProductHost } from '@/lib/product'

export const dynamic = 'force-dynamic'

// 매체별 사이트맵: 첫 화면·섹션·최근 기사 1,000건
export async function GET() {
  // IM 뉴스룸 제품 홈페이지 도메인: 소개·체험·약관 화면
  if (isProductHost(headers().get('host'))) {
    // 체험 신청은 편집국 주소에 있다 (appLive 이후)
    const loc = (p: string) => (p === '/trial' && PRODUCT.appLive ? appLink(p) : `${PRODUCT.url}${p}`)
    const urls = PRODUCT_PAGES.map((p) => `<url><loc>${loc(p)}</loc><priority>${p === '/' ? '1.0' : '0.5'}</priority></url>`)
    return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
  }
  const site = await currentSite()
  const base = siteBaseUrl(site, headers().get('host'))
  const articles = await getFeedArticles(site, 1000)
  const urls = [
    `<url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`,
    ...site.sections.map((s) => `<url><loc>${base}/section/${xml(s.slug)}</loc><changefreq>hourly</changefreq><priority>0.8</priority></url>`),
    ...articles.map((a) => `<url><loc>${base}/news/${a.id}</loc><lastmod>${new Date(a.updated_at ?? a.published_at ?? Date.now()).toISOString()}</lastmod><priority>0.6</priority></url>`),
    ...['privacy', 'youth'].map((p) => `<url><loc>${base}/policy/${p}</loc><changefreq>yearly</changefreq><priority>0.1</priority></url>`),
  ]
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
}
