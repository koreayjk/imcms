import type { Metadata } from 'next'
import { headers } from 'next/headers'
import type { CSSProperties, ReactNode } from 'react'
import { GDPA, gdpaBaseFor } from '@/lib/gdpa'
import GdpaHeader from '@/components/gdpa/GdpaHeader'
import GdpaFooter from '@/components/gdpa/GdpaFooter'

export const metadata: Metadata = {
  title: { default: `${GDPA.short} ${GDPA.name}`, template: `%s | ${GDPA.short} ${GDPA.name}` },
  description: GDPA.description,
  icons: { icon: '/gdpa/logo-mark.svg' },
  openGraph: { title: `${GDPA.short} ${GDPA.name}`, description: GDPA.description, siteName: GDPA.name, locale: 'ko_KR', type: 'website' },
}

// 협회 색: 남색(신뢰) + 금색(권위)
const PALETTE = {
  '--g-navy': '#0D2B4E', '--g-navy-d': '#081C33', '--g-gold': '#C8A24A', '--g-gold-ink': '#8A6D25',
  '--g-ink': '#14202E', '--g-sub': '#5A6878', '--g-line': '#E2E7EE', '--g-soft': '#F4F6F9',
} as CSSProperties

export default function GdpaLayout({ children }: { children: ReactNode }) {
  const base = gdpaBaseFor(headers().get('host'))
  return (
    <div style={PALETTE} className="min-h-screen bg-white text-[var(--g-ink)] [word-break:keep-all]">
      <GdpaHeader base={base} />
      <main>{children}</main>
      <GdpaFooter base={base} />
    </div>
  )
}
