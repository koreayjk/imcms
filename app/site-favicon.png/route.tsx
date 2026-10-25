import { ImageResponse } from 'next/og'
import { currentSite } from '@/lib/public-data'

// 매체 탭 아이콘을 정사각형 PNG로 (lib/sites.ts siteIcon)
//   구글 검색·구글 뉴스는 정사각형 파비콘만 쓴다. 매체 로고가 정사각형이 아니어도 흰 칸 가운데에 맞춰 넣는다
//   ?size=512 : 앱 아이콘 크기 (192·512) / ?maskable=1 : 휴대폰이 동그랗게 잘라도 로고가 남게 여백을 넉넉히
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const site = await currentSite()
  const icon = site.iconUrl || site.logoMark
  if (!icon) return Response.redirect(new URL('/site-icon.svg', request.url), 307)
  const q = new URL(request.url).searchParams
  const size = q.get('size') === '512' ? 512 : 192
  const pad = Math.round(size * (q.get('maskable') === '1' ? 0.22 : site.iconUrl ? 0.04 : 0.08))
  const src = /^https?:\/\//.test(icon) ? icon : new URL(icon, request.url).toString()
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size - pad * 2} height={size - pad * 2} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
