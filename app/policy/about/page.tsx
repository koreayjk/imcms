import type { Metadata } from 'next'
import Link from 'next/link'
import { currentSite } from '@/lib/public-data'
import PolicyPage from '@/components/site/PolicyPage'
import { siteIcon, topSections } from '@/lib/sites'
import { policyEffective } from '@/lib/policy-date'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'About Us' : '매체소개'} | ${site.name}`, description: site.description || undefined, icons: { icon: siteIcon(site) }, ...(site.indexable ? { robots: { index: true, follow: true } } : {}) }
}

// 매체 소개: 발행 정보(하단 표시 정보)와 섹션을 한 곳에 모아 독자·검색·AI가 "누가 만드는 매체인지" 확인하게 한다
export default async function AboutPage() {
  const site = await currentSite()
  const en = site.lang === 'en'
  const l = site.legal
  const sections = topSections(site)
  const rows: [string, string][] = en
    ? [['Name', site.name + (site.nameEn && site.nameEn !== site.name ? ` (${site.nameEn})` : '')], ['Registration no.', l.registrationNo], ['Registration date', l.registeredAt], ['Publisher', l.publisher], ['Editor', l.editor], ['Company', l.company], ['CEO', l.ceo], ['Address', [l.postcode, l.address].filter(Boolean).join(' ')], ['Phone', l.phone], ['Email', l.email]]
    : [['제호', site.name + (site.nameEn && site.nameEn !== site.name ? ` (${site.nameEn})` : '')], ['등록번호', l.registrationNo], ['등록일', l.registeredAt], ['발행인', l.publisher], ['편집인', l.editor], ['청소년보호책임자', l.youthOfficer], ['회사', l.company], ['대표자', l.ceo], ['사업자등록번호', l.bizNo], ['발행소 주소', [l.postcode, l.address].filter(Boolean).join(' ')], ['전화', l.phone], ['이메일', l.email]]
  const shown = rows.filter(([, v]) => v && v.trim())
  const eff = policyEffective(site, '2026-10-28')

  return (
    <PolicyPage site={site} slug="about" effective={eff}>
      <p>{site.description || (en ? `${site.name} is an online newspaper.` : `${site.name}은(는) 인터넷신문입니다.`)}</p>
      {site.slogan && <p className="text-sub">“{site.slogan}”</p>}

      <section>
        <h2>{en ? 'Who publishes this site' : '발행 정보'}</h2>
        <table>
          <tbody>
            {shown.map(([k, v]) => <tr key={k}><th scope="row" className="w-[34%]">{k}</th><td>{v}</td></tr>)}
          </tbody>
        </table>
      </section>

      {sections.length > 0 && (
        <section>
          <h2>{en ? 'What we cover' : '다루는 분야'}</h2>
          <ul>
            {sections.map((s) => (
              <li key={s.slug}><Link href={`/section/${s.slug}`} className="font-semibold text-brand hover:underline">{s.name}</Link>{s.description ? ` — ${s.description}` : ''}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>{en ? 'How we work' : '이렇게 만듭니다'}</h2>
        <ul>
          <li>{en ? <>Our standards for accuracy, sourcing and independence are in <Link href="/policy/editorial" className="text-brand underline">Editorial Principles</Link>.</> : <>사실 확인, 출처 표기, 독립성 같은 기준은 <Link href="/policy/editorial" className="text-brand underline">편집원칙</Link>에 있습니다.</>}</li>
          <li>{en ? <>To report an error or send a tip, see <Link href="/policy/corrections" className="text-brand underline">Corrections and Tips</Link>.</> : <>오류를 알리거나 제보할 때는 <Link href="/policy/corrections" className="text-brand underline">정정·반론·제보</Link> 안내를 봐 주세요.</>}</li>
          <li>{en ? <>Every story shows its reporter, publication time and, if revised, the time of the update. Follow us by <a href="/rss.xml" className="text-brand underline">RSS</a>.</> : <>모든 기사에 기자 이름과 발행 시각이 표시되고, 고친 기사에는 수정 시각이 함께 표시됩니다. <a href="/rss.xml" className="text-brand underline">RSS</a>로 구독할 수 있습니다.</>}</li>
        </ul>
      </section>
    </PolicyPage>
  )
}
