import ArticleEditor from '@/components/ArticleEditor'
import { getCmsContext } from '@/lib/cms'
import { outletEmailOf } from '@/lib/outlet-email'
import { getT } from '@/lib/cms-t'

// 승인신청·발행할 때 AI 법적 검수를 기다린다
export const maxDuration = 60

export default async function NewArticlePage() {
  const { t } = await getT()
  const { supabase, user, profile, outletId, isEditorPlus, trial, viewAs, viewGroupId } = await getCmsContext()

  const [{ data: categories }, { data: outlets }] = await Promise.all([
    outletId
      ? supabase.from('categories').select('*').eq('outlet_id', outletId).order('sort_order')
      : supabase.from('categories').select('*').order('sort_order'),
    viewAs && viewGroupId ? supabase.from('outlets').select('id, name, site').eq('publisher_id', viewGroupId).order('created_at') : supabase.from('outlets').select('id, name, site').order('created_at'),
  ])
  const outlet = outlets?.find((o) => o.id === outletId)
  const contact = await outletEmailOf(supabase, outletId)

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <h1 className="mb-6 text-[22px] font-bold tracking-tight">{t('기사쓰기', 'Write')}</h1>
      <ArticleEditor
        categories={categories ?? []}
        userId={user.id}
        outletId={outletId}
        outletName={outlet?.name ?? null}
        englishOutlet={(outlet as { site?: { lang?: string } | null } | undefined)?.site?.lang === 'en'}
        timeZone={(outlet as { site?: { timeZone?: string } | null } | undefined)?.site?.timeZone}
        authorName={profile?.full_name ?? ''}
        authorEmail={user.email ?? null}
        isEditorPlus={isEditorPlus}
        moderated={!!trial}
        outlets={outlets ?? []}
        syndicatedOutletIds={[]}
        outletEmail={contact.email}
        settingsReady={contact.ready}
        sourceOutletName={null}
      />
    </div>
  )
}
