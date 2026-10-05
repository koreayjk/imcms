import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import CategoryManager from '@/components/CategoryManager'

// 섹션 관리: 편집장 이상은 자기 매체, 매니저는 상단에서 고른 고객사 매체
export default async function CategoriesPage() {
  const { supabase, outletId, canEditSite } = await getCmsContext()
  if (!canEditSite) redirect('/articles')
  if (!outletId) {
    return <p className="px-4 py-10 md:px-8 md:py-16 text-center text-muted">위쪽 매체 선택에서 섹션을 고칠 매체를 먼저 골라 주세요.</p>
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('outlet_id', outletId)
    .order('sort_order')

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">카테고리 관리</h1>
        <p className="text-sm text-muted mt-0.5">기사 분류에 사용할 카테고리를 관리합니다</p>
      </header>
      <CategoryManager categories={categories ?? []} outletId={outletId} />
    </div>
  )
}
