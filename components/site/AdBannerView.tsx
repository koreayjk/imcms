'use client'

import type { AdBanner } from '@/lib/ads'
import { AdView } from './AdView'
import AdCode from './AdCode'

// 배너 하나 (광고는 기사와 헷갈리지 않게 “광고” 표시를 붙인다)
export default function AdBannerView({ banner: b, className = '' }: { banner: AdBanner; className?: string }) {
  return (
    <AdView id={b.id} className={`relative ${className}`}>
      {b.kind === 'code' && b.code ? (
        <AdCode code={b.code} />
      ) : b.image_url ? (
        b.link_url ? (
          <a href={`/ad/${b.id}`} target="_blank" rel="sponsored noopener" className="block" aria-label={`광고: ${b.name}`}>
            <Picture b={b} />
          </a>
        ) : (
          <Picture b={b} />
        )
      ) : null}
      {b.kind === 'image' && <span className="pointer-events-none absolute right-0 top-0 bg-black/45 px-1 text-[10px] leading-[15px] text-white">광고</span>}
    </AdView>
  )
}

function Picture({ b }: { b: AdBanner }) {
  return (
    <picture>
      {b.mobile_image_url && <source media="(max-width: 767px)" srcSet={b.mobile_image_url} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.image_url ?? ''} alt={`광고: ${b.name}`} loading="lazy" className="mx-auto block h-auto w-full" />
    </picture>
  )
}
