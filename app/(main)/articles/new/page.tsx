import ArticleEditor from '@/components/ArticleEditor'
import { getCmsContext } from '@/lib/cms'

export default async function NewArticlePage() {
  const { supabase, user, profile, outletId, isEditorPlus } = await getCmsContext()

  const [{ data: categories }, { data: outlets }] = await Promise.all([
    outletId
      ? supabase.from('categories').select('*').eq('outlet_id', outletId).order('sort_order')
      : supabase.from('categories').select('*').order('sort_order'),
    supabase.from('outlets').select('id, name').order('created_at'),
  ])
  const outlet = outlets?.find((o) => o.id === outletId)

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <h1 className="mb-6 text-[22px] font-bold tracking-tight">기사쓰기</h1>
      <ArticleEditor
        categories={categories ?? []}
        userId={user.id}
        outletId={outletId}
        outletName={outlet?.name ?? null}
        authorName={profile?.full_name ?? ''}
        authorEmail={user.email ?? null}
        isEditorPlus={isEditorPlus}
        outlets={outlets ?? []}
        syndicatedOutletIds={[]}
        sourceOutletName={null}
      />
    </div>
  )
}
