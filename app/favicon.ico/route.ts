import { headers } from 'next/headers'
import { isAppHost, isProductHost } from '@/lib/product'

// /favicon.ico: 검색엔진·브라우저가 따로 찾아오는 주소. 매체는 매체 아이콘, IM 뉴스룸 주소는 IM 뉴스룸 아이콘으로
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const host = (await headers()).get('host')
  const to = isProductHost(host) || isAppHost(host) ? '/brand/favicon-48.png' : '/site-favicon.png'
  return new Response(null, { status: 308, headers: { Location: new URL(to, request.url).toString(), 'Cache-Control': 'public, max-age=86400' } })
}
