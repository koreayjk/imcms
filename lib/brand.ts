import type { Metadata } from 'next'

// IM 뉴스룸 로고 아이콘 (편집국·소개 사이트·로그인 화면). 매체 홈페이지는 매체마다 따로 정한 아이콘(siteIcon)을 쓴다
export const BRAND_NAVY = '#1D3461'
export const BRAND_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
    { url: '/brand/favicon-48.png', sizes: '48x48', type: 'image/png' },
    { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
  ],
  apple: { url: '/brand/apple-touch-icon.png', sizes: '180x180' },
}

// 편집국을 휴대폰 홈 화면·앱으로 설치할 때 (편집국과 로그인 화면에만 붙인다. 매체 홈페이지에서는 설치를 권하지 않는다)
export const APP_METADATA: Metadata = {
  icons: BRAND_ICONS,
  manifest: '/brand/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'IM 뉴스룸', statusBarStyle: 'default' },
}
