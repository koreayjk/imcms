import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CategoryManager from '@/components/CategoryManager'

export default async function CategoriesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, outlet_id')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'editor' && profile.role !== 'admin')) {
    redirect('/articles')
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">카테고리 관리</h1>
        <p className="text-sm text-muted mt-0.5">기사 분류에 사용할 카테고리를 관리합니다</p>
      </header>
      <CategoryManager categories={categories ?? []} outletId={profile.outlet_id} />
    </div>
  )
}
