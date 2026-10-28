import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { siteForOutlet } from '@/lib/public-data'
import { topSections } from '@/lib/sites'
import { POLICIES } from '@/lib/policies'
import { portalChecks, type RecentStats } from '@/lib/portal-checks'
import InfoSheet from './InfoSheet'

// 포털(다음·네이트·줌·MSN 등) 제휴 신청 준비: ① 신청서에 붙여 넣을 매체 정보 한 장 ② 신청 전 자동 점검 (편집장 이상)
export default async function PortalPrepPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/articles')
  const { t, lang } = await getT()
  const en = lang === 'en'

  if (!outletId) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-8 md:px-8">
        <h1 className="text-[22px] font-bold tracking-tight">{t('포털 제휴 준비', 'Portal partnership prep')}</h1>
        <p className="mt-4 rounded-lg border border-line bg-white px-5 py-8 text-center text-[14px] text-muted">{t('상단에서 매체를 먼저 골라 주세요.', 'Choose an outlet at the top first.')}</p>
      </div>
    )
  }

  const site = await siteForOutlet(outletId)
  const base = `https://${site.domains[0] ?? ''}`
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [{ count: published }, recent] = await Promise.all([
    supabase.from('articles').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', 'published'),
    supabase.from('articles').select('title, byline, author_id, excerpt, thumbnail_url, published_at').eq('outlet_id', outletId).eq('status', 'published').gte('published_at', since).lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(500),
  ])
  const rows = (recent.data ?? []) as { title: string; byline: string | null; author_id: string | null; excerpt: string | null; thumbnail_url: string | null; published_at: string | null }[]
  const titleCount = new Map<string, number>()
  for (const r of rows) { const k = r.title.trim().replace(/\s+/g, ' '); titleCount.set(k, (titleCount.get(k) ?? 0) + 1) }
  const people = new Set(rows.map((r) => (r.byline?.trim() || r.author_id || '')).filter(Boolean))
  const { data: last } = await supabase.from('articles').select('published_at').eq('outlet_id', outletId).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(1).maybeSingle()
  const st: RecentStats = {
    published: published ?? 0,
    last30: rows.length,
    noByline: rows.filter((r) => !r.byline?.trim() && !r.author_id).length,
    noExcerpt: rows.filter((r) => !r.excerpt?.trim()).length,
    noThumb: rows.filter((r) => !r.thumbnail_url).length,
    dupTitles: [...titleCount.values()].filter((n) => n > 1).reduce((a, n) => a + n, 0),
    reporters: people.size,
    lastPublishedAt: (last as { published_at?: string | null } | null)?.published_at ?? null,
  }
  const checks = portalChecks(site, st)
  const idx = en ? 1 : 0
  const required = checks.filter((c) => c.group === 'required')
  const recommended = checks.filter((c) => c.group === 'recommended')
  const reqFail = required.filter((c) => !c.ok).length
  const l = site.legal
  const fixHref = isStaff ? `/admin/outlets/${outletId}/site` : '/admin/settings'

  const groups = [
    { title: t('매체 기본', 'Outlet'), rows: [
      { label: t('매체 이름(제호)', 'Name'), value: site.name },
      { label: t('영문 이름', 'English name'), value: site.nameEn ?? '' },
      { label: t('홈페이지 주소', 'Website'), value: site.domains[0] ? `${base}/` : '' },
      { label: t('슬로건', 'Slogan'), value: site.slogan ?? '' },
      { label: t('매체 소개', 'Description'), value: site.description ?? '' },
      { label: t('언어', 'Language'), value: site.lang === 'en' ? 'English' : '한국어' },
    ] },
    { title: t('등록·발행 정보', 'Registration and publisher'), rows: [
      { label: t('등록번호', 'Registration no.'), value: l.registrationNo },
      { label: t('등록일', 'Registration date'), value: l.registeredAt },
      { label: t('발행인', 'Publisher'), value: l.publisher },
      { label: t('편집인', 'Editor'), value: l.editor },
      { label: t('청소년보호책임자', 'Youth protection officer'), value: l.youthOfficer },
      { label: t('우편번호', 'Postcode'), value: l.postcode },
      { label: t('발행소 주소', 'Address'), value: l.address },
      { label: t('대표 전화', 'Phone'), value: l.phone },
      { label: t('대표 이메일', 'Email'), value: l.email },
    ] },
    { title: t('회사 정보', 'Company'), rows: [
      { label: t('회사 이름', 'Company'), value: l.company },
      { label: t('대표자', 'CEO'), value: l.ceo },
      { label: t('사업자등록번호', 'Business reg. no.'), value: l.bizNo },
    ] },
    { title: t('편집·운영 현황', 'Editorial status'), rows: [
      { label: t('섹션', 'Sections'), value: topSections(site).map((s) => s.name).join(', ') },
      { label: t('발행 기사 수(전체)', 'Published stories'), value: String(st.published) },
      { label: t('최근 30일 발행', 'Last 30 days'), value: String(st.last30) },
      { label: t('최근 30일 기자 수', 'Reporters (30 days)'), value: String(st.reporters) },
    ] },
    { title: t('수집용 주소', 'Feeds and policies'), rows: [
      { label: 'RSS', value: `${base}/rss.xml` },
      { label: t('사이트맵', 'Sitemap'), value: `${base}/sitemap.xml` },
      { label: t('뉴스 사이트맵', 'News sitemap'), value: `${base}/news-sitemap.xml` },
      { label: 'robots.txt', value: `${base}/robots.txt` },
      ...POLICIES.map((p) => ({ label: en ? p.titleEn : p.title, value: `${base}/policy/${p.slug}` })),
    ] },
  ]

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('포털 제휴 준비', 'Portal partnership prep')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {t('다음·네이트·줌·MSN 같은 포털에 뉴스 제휴를 신청하기 전에, 신청서에 붙여 넣을 매체 정보와 빠진 곳을 확인합니다. 제휴 심사 기준은 포털마다 다르고 바뀌므로 통과를 보장하지 않습니다. 신청은 발행인 이름으로 각 포털에서 직접 하거나, 운영팀에 대행을 요청해 주세요.', 'Before applying for news partnerships with portals such as Daum, Nate, Zum or MSN, check the outlet details to paste into the application and what is still missing. Each portal has its own criteria, which change over time, so passing is not guaranteed. Apply under the publisher’s name on each portal, or ask the operations team to handle it for you.')}
        </p>
      </header>

      <section aria-labelledby="checks" className="mb-8">
        <h2 id="checks" className="mb-3 flex flex-wrap items-center gap-2 text-[16px] font-bold">
          {t('신청 전 점검', 'Pre-application check')}
          <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${reqFail === 0 ? 'bg-published/15 text-published' : 'bg-danger/10 text-danger'}`}>
            {reqFail === 0 ? t('필수 항목 모두 통과', 'All required items pass') : t(`필수 ${reqFail}건 부족`, `${reqFail} required item${reqFail === 1 ? '' : 's'} missing`)}
          </span>
        </h2>
        {([[t('필수', 'Required'), required], [t('권장', 'Recommended'), recommended]] as const).map(([title, list]) => (
          <div key={title} className="mb-4">
            <h3 className="mb-1.5 text-[13px] font-bold text-muted">{title}</h3>
            <ul className="divide-y divide-line rounded-lg border border-line bg-white">
              {list.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-2.5 text-[13.5px]">
                  <span aria-label={c.ok ? t('통과', 'Pass') : t('부족', 'Missing')} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white ${c.ok ? 'bg-published' : c.group === 'required' ? 'bg-danger' : 'bg-draft'}`}>{c.ok ? '✓' : '!'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{c.label[idx]}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">{c.detail[idx]}</p>
                  </div>
                  {!c.ok && c.fix && <Link href={fixHref} className="shrink-0 text-[12.5px] text-review underline underline-offset-2">{t('고치기', 'Fix')}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-[12px] text-muted">{t('권장 기준 중 “최근 30일 30건”은 우리가 정한 참고 기준이며 포털의 공식 기준이 아닙니다. 점검은 지금 화면의 설정과 최근 30일 기사로 계산합니다.', 'The “30 stories in 30 days” guideline is our own and not an official portal threshold. The check uses current settings and the last 30 days of stories.')}</p>
      </section>

      <section aria-labelledby="sheet">
        <h2 id="sheet" className="mb-3 text-[16px] font-bold">{t('매체 정보 한 장', 'Outlet info sheet')}</h2>
        <InfoSheet groups={groups} />
      </section>
    </div>
  )
}
