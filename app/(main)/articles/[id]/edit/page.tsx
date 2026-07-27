import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import ArticleEditor from '@/components/ArticleEditor'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, outlet_id')
    .eq('id', user.id)
    .single()

  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!article) notFound()

  const isEditorPlus = profile?.role === 'editor' || profile?.role === 'admin'
  const isOwner = article.author_id === user.id

  if (!isOwner && !isEditorPlus) redirect('/articles')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">기사 수정</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`status-badge status-${article.status}`}>
              {STATUS_LABEL[article.status as ArticleStatus]}
            </span>
            <Link
              href={`/articles/${article.id}`}
              className="text-xs text-muted hover:text-ink"
            >
              미리보기 →
            </Link>
          </div>
        </div>
      </div>

      <ArticleEditor
        article={article as any}
        categories={categories ?? []}
        userId={user.id}
        outletId={profile?.outlet_id ?? null}
        isEditorPlus={isEditorPlus}
      />
    </div>
  )
}
