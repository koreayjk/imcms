import './globals.css'

import type { Metadata, Viewport } from 'next'

// 기본은 검색엔진 수집 금지. 오픈한 매체만 sites.ts의 indexable로 허용한다
export const metadata: Metadata = {
  title: 'IM CMS',
  description: '언론사용 기사 관리 시스템',
  robots: { index: false, follow: false },
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
