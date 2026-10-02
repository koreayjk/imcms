import Link from 'next/link'
import type { SiteConfig } from '@/lib/sites'
import Logo from './Logo'
import { POLICIES } from '@/lib/policies'

export default function SiteFooter({ site }: { site: SiteConfig }) {
  const l = site.legal
  const mail = `mailto:${l.email}`
  const year = new Date().getFullYear()
  return (
    <footer className="mt-14 border-t-4 border-brand bg-soft">
      <div className="border-b border-rule bg-white">
        <nav className="mx-auto flex max-w-[1200px] flex-wrap gap-x-5 gap-y-2 px-4 py-4 text-[13px] text-sub" aria-label="하단 메뉴">
          {site.sections.map((s) => (
            <Link key={s.slug} href={`/section/${s.slug}`} className="hover:text-brand">{s.name}</Link>
          ))}
          <span className="hidden flex-1 lg:block" />
          {POLICIES.map((p) => (
            <Link key={p.slug} href={`/policy/${p.slug}`} className={p.slug === 'privacy' ? 'font-bold text-body hover:text-brand' : 'hover:text-brand'}>{p.title}</Link>
          ))}
          {l.email && (
            <>
              <a href={`${mail}?subject=${encodeURIComponent('[기사제보]')}`} className="font-semibold text-body hover:text-brand">기사제보</a>
              <a href={`${mail}?subject=${encodeURIComponent('[광고문의]')}`} className="font-semibold text-body hover:text-brand">광고문의</a>
            </>
          )}
        </nav>
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 lg:flex-row lg:gap-12">
        <div className="flex-shrink-0">
          <Logo site={site} size="md" />
          {site.slogan && <p className="mt-3 text-[12.5px] text-sub">{site.slogan}</p>}
        </div>

        <div className="text-[12.5px] leading-[1.9] text-sub">
          {/* 비어 있는 항목은 빼고, 있는 것만 | 로 잇는다 */}
          <Line items={[['제호', site.name], ['등록번호', l.registrationNo], ['등록일', l.registeredAt]]} />
          <Line items={[['발행인', l.publisher], ['편집인', l.editor], ['청소년보호책임자', l.youthOfficer]]} />
          <Line items={[['상호', l.company], ['대표', l.ceo], ['사업자등록번호', l.bizNo]]} />
          {l.address && <p>주소 : {l.postcode ? `(${l.postcode}) ` : ''}{l.address}</p>}
          {(l.phone || l.email) && (
            <p>
              {l.phone && <span className="whitespace-nowrap">대표전화 : <a href={`tel:${l.phone.replace(/-/g, '')}`} className="hover:text-brand">{l.phone}</a></span>}
              {l.phone && l.email && <Sep />}
              {l.email && <span className="whitespace-nowrap">이메일 : <a href={mail} className="hover:text-brand">{l.email}</a></span>}
            </p>
          )}
          <p className="mt-3 text-[12px] text-[#8A918C]">
            {site.name}의 모든 콘텐츠(기사·사진·영상)는 저작권법의 보호를 받으며, 무단 전재·복사·배포를 금합니다.
          </p>
          <p className="text-[12px] text-[#8A918C]">© {year} {site.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

function Sep() {
  return <span className="mx-2 text-rule" aria-hidden>|</span>
}

function Line({ items }: { items: [string, string][] }) {
  const shown = items.filter(([, v]) => v?.trim())
  if (!shown.length) return null
  return (
    <p>
      {shown.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && <Sep />}
          <span className="whitespace-nowrap">{k} : {v}</span>
        </span>
      ))}
    </p>
  )
}
