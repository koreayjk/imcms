import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import ArticleEditor from '@/components/ArticleEditor'
import { getCmsContext } from '@/lib/cms'

export default async function EditArticlePage({ params }: { params: { id: string } }) {
  const { supabase, user, profile, outletId, isEditorPlus } = await getCmsContext()

  const { data: article } = await supabase.from('articles').select('*').eq('id', params.id).single()
  if (!article) notFound()
  if (article.author_id !== user.id && !isEditorPlus) redirect('/articles')

  const scope = article.outlet_id ?? outletId
  const [{ data: categories }, { data: outlets }, { data: copies }, { data: source }, { data: author }] = await Promise.all([
    scope
      ? supabase.from('categories').select('*').eq('outlet_id', scope).order('sort_order')
      : supabase.from('categories').select('*').order('sort_order'),
    supabase.from('outlets').select('id, name').order('created_at'),
    supabase.from('articles').select('outlet_id').eq('source_article_id', article.id),
    article.source_article_id
      ? supabase.from('articles').select('outlet:outlets(name)').eq('id', article.source_article_id).single()
      : Promise.resolve({ data: null }),
    supabase.from('profiles').select('full_name').eq('id', article.author_id).maybeSingle(),
  ])
  const outlet = outlets?.find((o) => o.id === scope)

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-[22px] font-bold tracking-tight">기사 수정</h1>
        <Link href={`/articles/${article.id}`} className="text-[13px] text-muted hover:text-ink">기사 보기 →</Link>
      </div>
      <ArticleEditor
        article={article as any}
        categories={categories ?? []}
        userId={user.id}
        outletId={scope}
        outletName={outlet?.name ?? null}
        authorName={profile?.full_name ?? ''}
        authorEmail={user.email ?? null}
        isEditorPlus={isEditorPlus}
        outlets={outlets ?? []}
        syndicatedOutletIds={(copies ?? []).map((c) => c.outlet_id as string)}
        sourceOutletName={(source as any)?.outlet?.name ?? null}
        articleAuthorName={author?.full_name ?? null}
      />
    </div>
  )
}
