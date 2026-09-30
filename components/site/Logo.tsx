import Link from 'next/link'
import type { SiteConfig } from '@/lib/sites'

type Props = { site: SiteConfig; size?: 'lg' | 'md' | 'sm' }

const SIZES = {
  lg: { mark: 'h-[58px]', full: 'h-[60px] max-w-[320px]', name: 'text-[30px]', en: 'text-[10.5px]', rule: 'w-5' },
  md: { mark: 'h-[44px]', full: 'h-[46px] max-w-[240px]', name: 'text-[23px]', en: 'text-[9px]', rule: 'w-4' },
  sm: { mark: 'h-[32px]', full: 'h-[34px] max-w-[180px]', name: 'text-[19px]', en: 'text-[7.5px]', rule: 'w-3' },
}

// mark: 심볼 + 이름 글자 / full: 로고 이미지만 / text: 이름 글자만 (매체 홈페이지 설정에서 고른다)
export default function Logo({ site, size = 'lg' }: Props) {
  const s = SIZES[size]
  const mode = site.logoMark ? site.logoMode ?? 'mark' : 'text'

  if (mode === 'full') {
    return (
      <Link href="/" className="inline-flex items-center" aria-label={`${site.name} 홈`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.logoMark} alt={site.name} className={`${s.full} w-auto object-contain`} />
      </Link>
    )
  }

  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${site.name} 홈`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {mode === 'mark' && <img src={site.logoMark} alt="" className={`${s.mark} w-auto`} />}
      <span className="flex flex-col items-center leading-none">
        <span className={`${s.name} font-extrabold tracking-[-0.04em] text-brand`}>{site.name}</span>
        {site.nameEn && (
          <span className="mt-1 flex items-center gap-1.5">
            <span className={`${s.rule} h-px bg-gold`} />
            <span className={`${s.en} font-serif tracking-[0.22em] text-brand whitespace-nowrap`}>{site.nameEn}</span>
            <span className={`${s.rule} h-px bg-gold`} />
          </span>
        )}
      </span>
    </Link>
  )
}
