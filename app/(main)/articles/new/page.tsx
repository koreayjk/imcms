import ArticleEditor from '@/components/ArticleEditor'
import { getCmsContext } from '@/lib/cms'
import { outletEmailOf } from '@/lib/outlet-email'

// 승인신청·발행할 때 AI 법적 검수를 기다린다
export const maxDuration = 60

export default async function NewArticlePage() {
  const { supabase, user, profile, outletId, isEditorPlus } = await getCmsContext()

  const [{ data: categories }, { data: outlets }] = await Promise.all([
    outletId
      ? supabase.from('categories').select('*').eq('outlet_id', outletId).order('sort_order')
      : supabase.from('categories').select('*').order('sort_order'),
    supabase.from('outlets').select('id, name').order('created_at'),
  ])
  const outlet = outlets?.find((o) => o.id === outletId)
  const contact = await outletEmailOf(supabase, outletId)

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
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
        outletEmail={contact.email}
        settingsReady={contact.ready}
        sourceOutletName={null}
      />
    </div>
  )
}
