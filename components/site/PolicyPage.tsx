import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SiteConfig } from '@/lib/sites'
import SiteFrame from './SiteFrame'
import { POLICIES } from '@/lib/policies'

export { POLICIES }


// 정책 페이지 공통 틀: 매체 법정 정보(하단 표시 정보)로 채운다
export default function PolicyPage({ site, slug, effective, children }: { site: SiteConfig; slug: string; effective: string; children: ReactNode }) {
  const p = POLICIES.find((x) => x.slug === slug)!
  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[860px] px-4 py-8 lg:py-12">
        <nav className="flex flex-wrap gap-2 text-[13px]" aria-label="정책">
          {POLICIES.map((x) => (
            <Link key={x.slug} href={`/policy/${x.slug}`} aria-current={x.slug === slug ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 ${x.slug === slug ? 'border-brand bg-brand text-white' : 'border-rule text-sub hover:border-brand hover:text-brand'}`}>
              {x.title}
            </Link>
          ))}
        </nav>
        <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em] text-brand">{p.title}</h1>
        <p className="mt-1 text-[13px] text-sub">{site.name} · 시행일 {effective}</p>
        <div className="policy mt-8 space-y-7 text-[15px] leading-[1.85] text-body [&_h2]:text-[17px] [&_h2]:font-bold [&_h2]:text-brand [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_p+p]:mt-2 [&_table]:mt-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13.5px] [&_td]:border [&_td]:border-rule [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-rule [&_th]:bg-soft [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:mt-2">
          {children}
        </div>
      </div>
    </SiteFrame>
  )
}

// 담당자 표기: 비어 있으면 매체 이름으로
export function officer(site: SiteConfig, name: string) {
  const l = site.legal
  return {
    name: name || l.publisher || l.ceo || `${site.name} 운영팀`,
    contact: [l.phone && `전화 ${l.phone}`, l.email && `이메일 ${l.email}`].filter(Boolean).join(' · ') || '하단 연락처',
  }
}
