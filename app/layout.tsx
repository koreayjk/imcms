import './globals.css'

import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'

// 기본은 검색엔진 수집 금지. 오픈한 매체만 sites.ts의 indexable로 허용한다
// 공유 이미지(og:image) 주소는 지금 들어온 도메인 기준 전체 주소로 만든다 (카카오톡은 전체 주소만 읽는다)
export async function generateMetadata(): Promise<Metadata> {
  const host = headers().get('x-forwarded-host') ?? headers().get('host')
  const proto = host?.startsWith('localhost') ? 'http' : 'https'
  let metadataBase: URL | undefined
  try { metadataBase = host ? new URL(`${proto}://${host}`) : undefined } catch {}
  return {
    metadataBase,
    title: 'IM CMS',
    description: '언론사용 기사 관리 시스템',
    robots: { index: false, follow: false },
  }
}

// 아이폰 홈 막대 영역까지 쓰고, 아래 탭은 safe-area 만큼 띄운다
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
