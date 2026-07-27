import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ArticleEditor from '@/components/ArticleEditor'

export default async function NewArticlePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, outlet_id')
    .eq('id', user.id)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  const isEditorPlus = profile?.role === 'editor' || profile?.role === 'admin'

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">새 기사 작성</h1>
      </header>
      <ArticleEditor
        categories={categories ?? []}
        userId={user.id}
        outletId={profile?.outlet_id ?? null}
        isEditorPlus={isEditorPlus}
      />
    </div>
  )
}
