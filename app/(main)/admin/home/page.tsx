import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { normalizeLayout } from '@/lib/home-layout'
import HomeBoard, { type BoardArticle } from '@/components/cms/HomeBoard'

const FIELDS = 'id, title, thumbnail_url, published_at, category:categories(name)'

export default async function HomeEditPage() {
  const { supabase, outletId, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/newsroom')

  const { data: outlets } = await supabase.from('outlets').select('id, name').order('created_at')
  const outlet = outlets?.find((o) => o.id === outletId) ?? outlets?.[0]
  if (!outlet) {
    return <p className="px-8 py-16 text-center text-muted">등록된 매체가 없습니다. 매체 관리에서 먼저 매체를 등록하세요.</p>
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
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">홈 편집판 <span className="ml-1 text-[15px] font-medium text-muted">{outlet.name}</span></h1>
        <p className="mt-1 text-[13px] text-muted">
          오른쪽 기사를 원하는 자리로 끌어다 놓으세요. 기사를 누른 뒤 자리를 눌러도 됩니다. 비워둔 자리는 최신 기사로 자동 채워집니다.
        </p>
      </div>
      {layoutError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">
          편집판 저장 공간이 아직 없습니다. Supabase에서 <code>supabase/home-layout.sql</code>을 실행해 주세요.
        </p>
      ) : (
        <HomeBoard outletId={outlet.id} initialLayout={layout} articles={articles} savedAt={saved?.updated_at ?? null} />
      )}
    </div>
  )
}
