import { headers } from 'next/headers'
import { currentSite, siteBaseUrl } from '@/lib/public-data'

export const dynamic = 'force-dynamic'

// 매체별 robots.txt: 홈페이지 설정에서 “검색 허용”을 켠 매체만 수집을 허락한다 (오픈 전에는 전부 막음)
export async function GET() {
  const site = await currentSite()
  const host = (headers().get('host') ?? '').split(':')[0].toLowerCase()
  const base = siteBaseUrl(site, host)
  // 매체 도메인으로 들어온 경우만 허용 (imcms.vercel.app 같은 관리 주소는 같은 기사가 중복 수집되지 않게 막는다)
  const ownHost = site.domains.includes(host)
  const body = site.indexable && !site.preview && ownHost
    ? [
        'User-agent: *',
        'Allow: /',
        // 편집국·내부 경로는 수집하지 않는다
        ...['/newsroom', '/articles', '/press', '/admin', '/support', '/account', '/login', '/signup', '/pending', '/api/', '/ai-review/', '/search', '/p/'].map((p) => `Disallow: ${p}`),
        '',
        `Sitemap: ${base}/sitemap.xml`,
        `Sitemap: ${base}/news-sitemap.xml`,
      ].join('\n')
    : 'User-agent: *\nDisallow: /'
  return new Response(body + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } })
}
