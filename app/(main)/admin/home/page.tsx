import Link from 'next/link'
import { outletHomeUrl } from '@/lib/product'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { normalizeLayout } from '@/lib/home-layout'
import { parseHomeLayout } from '@/lib/home-layouts'
import HomeBoard, { type BoardArticle } from '@/components/cms/HomeBoard'

const FIELDS = 'id, title, thumbnail_url, published_at, category:categories(name)'

export default async function HomeEditPage() {
  const { supabase, outletId, canEditSite, isStaff, isSuper, viewAs, viewGroupId } = await getCmsContext()
  const { t } = await getT()
  if (!canEditSite) redirect('/newsroom')

  const { data: outlets } = viewAs && viewGroupId
    ? await supabase.from('outlets').select('id, name, domain, site').eq('publisher_id', viewGroupId).order('created_at')
    : await supabase.from('outlets').select('id, name, domain, site').order('created_at')
  // 매니저는 상단에서 고른 고객사 매체만 (고르기 전이면 안내)
  const outlet = outlets?.find((o) => o.id === outletId) ?? (isStaff && !isSuper ? undefined : outlets?.[0])
  if (!outlet && isStaff && !isSuper) {
    return <p className="px-4 py-10 md:px-8 md:py-16 text-center text-muted">{t('위쪽 매체 선택에서 수정할 고객사 매체를 먼저 골라 주세요.', 'Choose a client outlet to edit at the top first.')}</p>
  }
  if (!outlet) {
    return <p className="px-4 py-10 md:px-8 md:py-16 text-center text-muted">{t('등록된 매체가 없습니다. 매체 관리에서 먼저 매체를 등록하세요.', 'No outlets are registered. Add an outlet under Outlet management first.')}</p>
  }

  const [{ data: saved, error: layoutError }, { data: recent }] = await Promise.all([
    supabase.from('home_layouts').select('layout, updated_at').eq('outlet_id', outlet.id).maybeSingle(),
    supabase.from('articles').select(FIELDS).eq('outlet_id', outlet.id).eq('status', 'published').order('published_at', { ascending: false }).limit(80),
  ])

  const layout = normalizeLayout(saved?.layout)
  const known = new Set((recent ?? []).map((a) => a.id))
  const missing = Object.values(layout).flat().filter((id): id is string => !!id && !known.has(id))
  const { data: extra } = missing.length
    ? await supabase.from('articles').select(FIELDS).in('id', missing).eq('status', 'published')
    : { data: [] }

  const articles: BoardArticle[] = [...(recent ?? []), ...(extra ?? [])].map((a: any) => ({
    id: a.id,
    title: a.title,
    thumbnail_url: a.thumbnail_url,
    published_at: a.published_at,
    category: a.category?.name ?? null,
  }))

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[22px] font-bold tracking-tight">{t('홈 편집판', 'Front page editor')} <span className="ml-1 text-[15px] font-medium text-muted">{outlet.name}</span></h1>
          {(outlet as { site?: { indexWidget?: boolean } | null }).site?.indexWidget && (
            <Link href="/admin/indices" className="btn-secondary bg-white">{t('해운 운임지수 입력 →', 'Enter shipping freight indices →')}</Link>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {t('오른쪽 기사를 원하는 자리로 끌어다 놓으세요. 기사를 누른 뒤 자리를 눌러도 됩니다. 비워둔 자리는 최신 기사로 자동 채워집니다.', 'Drag stories from the right into the slots you want. You can also click a story and then click a slot. Empty slots are filled automatically with the latest stories.')}
        </p>
      </div>
      {layoutError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">
          {t('편집판 저장 공간이 아직 없습니다. Supabase에서', 'There is no storage for the front page layout yet. Run')} <code>supabase/home-layout.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}
        </p>
      ) : (
        <HomeBoard homeLayout={parseHomeLayout((outlet as { site?: { homeLayout?: unknown } | null }).site?.homeLayout)} outletId={outlet.id} siteUrl={outletHomeUrl(outlet as { id: string; domain?: string | null })} initialLayout={layout} articles={articles} savedAt={saved?.updated_at ?? null} />
      )}
    </div>
  )
}
