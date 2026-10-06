import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { SITES, type OutletSiteSettings } from '@/lib/sites'
import SiteSettingsForm from '@/components/cms/SiteSettingsForm'
import DomainPanel from '@/components/cms/DomainPanel'
import { domainStatus } from '@/lib/vercel-domains'

export default async function SiteSettingsPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/admin/outlets')

  const [{ data: outlet }, { data: cats }] = await Promise.all([
    supabase.from('outlets').select('*').eq('id', params.id).maybeSingle(),
    supabase.from('categories').select('*').eq('outlet_id', params.id).order('sort_order'),
  ])
  if (!outlet) notFound()
  if (!('site' in outlet)) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">홈페이지 설정을 쓰려면 총관리자가 Supabase에서 <code>supabase/outlet-sites.sql</code>을 실행해야 합니다.</p>
      </div>
    )
  }

  // DB 설정이 비어 있는 매체는 코드에 있던 설정(있다면)으로 칸을 채워 보여준다
  const code = SITES.find((x) => outlet.domain && x.domains.includes(outlet.domain))
  const defaults: OutletSiteSettings = code
    ? {
        nameEn: code.nameEn, slogan: code.slogan, sloganEn: code.sloganEn, description: code.description,
        logoUrl: code.logoMark, logoMode: 'mark', colors: { brand: code.colors.brand, accent: code.colors.gold },
        indexable: code.indexable, pressKeywords: code.pressKeywords.join(', '), legal: code.legal,
      }
    : { logoMode: 'text', legal: { company: outlet.name } }

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 md:px-8 md:py-8">
      <nav className="mb-4 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/admin/outlets" className="hover:text-ink">매체</Link>
        <span>›</span>
        <span className="text-ink">{outlet.name} 홈페이지 설정</span>
      </nav>
      <h1 className="mb-1 text-[22px] font-bold tracking-tight">{outlet.name} 홈페이지 설정</h1>
      <p className="mb-6 text-[13px] text-muted">로고·색·하단 정보·도메인을 정하면 이 매체의 신문 홈페이지가 만들어집니다.</p>
      <DomainPanel outletId={outlet.id} domain={outlet.domain} status={outlet.domain ? await domainStatus(outlet.domain) : { state: 'off' }} />
      <SiteSettingsForm
        outlet={{ id: outlet.id, name: outlet.name, domain: outlet.domain, site: outlet.site as OutletSiteSettings }}
        sections={(cats ?? []) as any}
        defaults={defaults}
      />
    </div>
  )
}
