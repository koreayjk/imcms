import { currentSite } from '@/lib/public-data'
import { outletApp } from '@/lib/android'

// 매체 독자용 앱 설치 정보 (독자용 앱이 있는 매체만, lib/android.ts OUTLET_APPS)
//   플레이 스토어 앱을 만들 때 이름·아이콘·색을 여기서 읽는다. 크롬은 홈 화면 설치 대신 스토어 앱을 권한다
export const dynamic = 'force-dynamic'

export async function GET() {
  const site = await currentSite()
  const app = outletApp(site.domains)
  if (!app) return new Response('Not found', { status: 404 })
  const icon = (q: string) => `/site-favicon.png?${q}`
  const body = {
    id: '/',
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: 'ko',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: site.colors.brand,
    icons: [
      { src: icon('size=192'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon('size=512'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon('size=512&maskable=1'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    ...(app.live ? {
      related_applications: [{ platform: 'play', id: app.package, url: `https://play.google.com/store/apps/details?id=${app.package}` }],
      prefer_related_applications: true,
    } : {}),
  }
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } })
}
