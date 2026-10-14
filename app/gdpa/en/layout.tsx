import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { GDPA, GDPA_EN } from '@/lib/gdpa'

// 협회 사이트 영문판 (/en). 머리·바닥은 위 협회 레이아웃이 주소를 보고 영어로 바꾼다
export const metadata: Metadata = {
  title: { absolute: `${GDPA.short} ${GDPA_EN.name}`, template: `%s | ${GDPA.short} ${GDPA_EN.name}` },
  description: GDPA_EN.description,
  openGraph: { title: `${GDPA.short} ${GDPA_EN.name}`, description: GDPA_EN.description, siteName: GDPA_EN.name, locale: 'en_US', type: 'website', images: [{ url: '/gdpa/og.png', width: 1200, height: 630 }] },
}

export default function GdpaEnLayout({ children }: { children: ReactNode }) {
  return (
    <div lang="en">
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.lang='en'" }} />
      {children}
    </div>
  )
}
