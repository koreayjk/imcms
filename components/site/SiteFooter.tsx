import Link from 'next/link'
import { topSections, type SiteConfig } from '@/lib/sites'
import Logo from './Logo'
import { POLICIES } from '@/lib/policies'
import NewsletterBox from './NewsletterBox'
import { mailReady } from '@/lib/mail'
import { siteText } from '@/lib/site-text'

export default function SiteFooter({ site }: { site: SiteConfig }) {
  const l = site.legal
  const mail = `mailto:${l.email}`
  const year = new Date().getFullYear()
  const t = siteText(site)
  const adsHref = site.outletId ? '/inquiry/ads' : `${mail}?subject=${encodeURIComponent(t.adsSubject)}`
  const en = site.lang === 'en'
  return (
    <footer className="mt-14 border-t-4 border-brand bg-soft">
      <div className="border-b border-rule bg-white">
        <nav className="mx-auto flex max-w-[1200px] flex-wrap gap-x-5 gap-y-2 px-4 py-4 text-[13px] text-sub" aria-label={t.footerNav}>
          {topSections(site).map((s) => (
            <Link key={s.slug} href={`/section/${s.slug}`} className="hover:text-brand">{s.name}</Link>
          ))}
          <span className="hidden flex-1 lg:block" />
          {POLICIES.map((p) => (
            <Link key={p.slug} href={`/policy/${p.slug}`} className={p.slug === 'privacy' ? 'font-bold text-body hover:text-brand' : 'hover:text-brand'}>{en ? p.titleEn : p.title}</Link>
          ))}
          {l.email && (
            <>
              <a href={`${mail}?subject=${encodeURIComponent(t.tipSubject)}`} className="font-semibold text-body hover:text-brand">{t.tip}</a>
              <a href={adsHref} className="font-semibold text-body hover:text-brand">{t.ads}</a>
            </>
          )}
        </nav>
      </div>

      {site.outletId && mailReady() && (
        <div className="border-b border-rule bg-white">
          <div className="mx-auto max-w-[1200px] px-4 py-6"><NewsletterBox siteName={site.name} lang={site.lang} /></div>
        </div>
      )}
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 lg:flex-row lg:gap-12">
        <div className="flex-shrink-0">
          <Logo site={site} size="md" />
          {site.slogan && <p className="mt-3 text-[12.5px] text-sub">{site.slogan}</p>}
        </div>

        <div className="text-[12.5px] leading-[1.9] text-sub">
          {/* 비어 있는 항목은 빼고, 있는 것만 | 로 잇는다 */}
          <Line items={[[t.legal.name, site.name], [t.legal.reg, l.registrationNo], [t.legal.regAt, l.registeredAt]]} />
          <Line items={[[t.legal.publisher, l.publisher], [t.legal.editor, l.editor], [t.legal.youth, l.youthOfficer]]} />
          <Line items={[[t.legal.company, l.company], [t.legal.ceo, l.ceo], [t.legal.biz, l.bizNo]]} />
          {l.address && <p>{t.legal.address} : {l.postcode ? `(${l.postcode}) ` : ''}{l.address}</p>}
          {(l.phone || l.email) && (
            <p>
              {l.phone && <span className="whitespace-nowrap">{t.legal.phone} : <a href={`tel:${l.phone.replace(/-/g, '')}`} className="hover:text-brand">{l.phone}</a></span>}
              {l.phone && l.email && <Sep />}
              {l.email && <span className="whitespace-nowrap">{t.legal.email} : <a href={mail} className="hover:text-brand">{l.email}</a></span>}
            </p>
          )}
          <p className="mt-3 text-[12px] text-[#8A918C]">
            {t.rights(site.name)}
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
