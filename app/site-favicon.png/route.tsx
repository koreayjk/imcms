import { ImageResponse } from 'next/og'
import { currentSite } from '@/lib/public-data'

// 매체 탭 아이콘을 정사각형 PNG로 (lib/sites.ts siteIcon)
//   구글 검색·구글 뉴스는 정사각형 파비콘만 쓴다. 매체 로고가 정사각형이 아니어도 흰 칸 가운데에 맞춰 넣는다
export const dynamic = 'force-dynamic'

const SIZE = 192

export async function GET(request: Request) {
  const site = await currentSite()
  if (!site.logoMark) return Response.redirect(new URL('/site-icon.svg', request.url), 307)
  const src = /^https?:\/\//.test(site.logoMark) ? site.logoMark : new URL(site.logoMark, request.url).toString()
  const pad = Math.round(SIZE * 0.08)
  return new ImageResponse(
    (
      <div style={{ width: SIZE, height: SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={SIZE - pad * 2} height={SIZE - pad * 2} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: SIZE, height: SIZE, headers: { 'Cache-Control': 'public, max-age=86400' } },
  )
}
