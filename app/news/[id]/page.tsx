import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const supabase = anonClient()
  const { data } = await supabase
    .from('articles')
    .select('title, meta_title, meta_description, excerpt, thumbnail_url')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!data) return { title: '기사를 찾을 수 없습니다' }

  return {
    title: data.meta_title || data.title,
    description: data.meta_description || data.excerpt || undefined,
    openGraph: {
      title: data.meta_title || data.title,
      description: data.meta_description || data.excerpt || undefined,
      images: data.thumbnail_url ? [data.thumbnail_url] : undefined,
    },
  }
}

export default async function PublicArticlePage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = anonClient()

  const { data: article } = await supabase
    .from('articles')
    .select('*, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug), outlet:outlets(name)')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  // 조회수 증가 (fire-and-forget)
  supabase
    .from('articles')
    .update({ view_count: (article.view_count || 0) + 1 })
    .eq('id', params.id)
    .then(() => {})

  // 관련 기사 (같은 카테고리)
  const { data: related } = article.category_id
    ? await supabase
        .from('articles')
        .select('id, title, published_at, thumbnail_url')
        .eq('status', 'published')
        .eq('category_id', article.category_id)
        .neq('id', article.id)
        .order('published_at', { ascending: false })
        .limit(4)
    : { data: [] }

  const siteName = (article.outlet as any)?.name ?? 'IM NEWS'
  const categoryName = (article.category as any)?.name
  const authorName = (article.author as any)?.full_name

  return (
    <div className="min-h-screen bg-paper">
      {/* 미니 헤더 */}
      <header className="border-b-2 border-ink">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight hover:opacity-80">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted">
            <Link href="/" className="hover:text-ink">홈</Link>
            {categoryName && (
              <>
                <span>/</span>
                <Link href={`/?category=${(article.category as any)?.slug}`} className="hover:text-ink">
                  {categoryName}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* 본문 영역 */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 카테고리 배지 */}
          {categoryName && (
            <Link
              href={`/?category=${(article.category as any)?.slug}`}
              className="inline-block text-xs font-bold uppercase tracking-widest text-review hover:opacity-80 mb-3"
            >
              {categoryName}
            </Link>
          )}

          {/* 제목 */}
          <h1 className="text-3xl font-bold leading-tight mb-4">
            {article.title}
          </h1>

          {/* 리드문 */}
          {article.excerpt && (
            <p className="text-base text-muted italic border-l-[3px] border-ink pl-4 mb-5 leading-relaxed">
              {article.excerpt}
            </p>
          )}

          {/* 메타 정보 */}
          <div className="flex items-center gap-3 text-xs text-muted pb-5 mb-6 border-b border-line">
            {authorName && (
              <span className="font-medium text-ink">{authorName}</span>
            )}
            {article.published_at && (
              <>
                <span>·</span>
                <time dateTime={article.published_at}>
                  {new Date(article.published_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </time>
              </>
            )}
            {article.view_count > 0 && (
              <>
                <span>·</span>
                <span>조회 {article.view_count.toLocaleString()}</span>
              </>
            )}
          </div>

          {/* 대표 이미지 */}
          {article.thumbnail_url && (
            <figure className="mb-7">
              <img
                src={article.thumbnail_url}
                alt={article.title}
                className="w-full object-cover"
              />
            </figure>
          )}

          {/* 본문 */}
          <div className="text-[15px] leading-8 text-ink whitespace-pre-wrap">
            {article.body}
          </div>

          {/* 태그 */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 pt-5 border-t border-line flex flex-wrap gap-2">
              {article.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-ink hover:text-ink cursor-default transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* 공유 + 목록 */}
          <div className="mt-8 pt-5 border-t-2 border-ink flex items-center justify-between">
            <Link href="/" className="text-sm text-muted hover:text-ink">
              ← 목록으로
            </Link>
            <div className="flex gap-2 text-xs text-muted">
              <button
                onClick={() => {}}
                className="border border-line rounded px-3 py-1.5 hover:bg-line/40 transition-colors"
                aria-label="공유"
              >
                공유
              </button>
            </div>
          </div>
        </div>

        {/* 관련 기사 */}
        {related && related.length > 0 && (
          <section className="mt-12 border-t border-line pt-8">
            <h2 className="text-sm font-bold uppercase tracking-widest border-b-2 border-ink pb-1.5 mb-5">
              관련 기사
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {related.map((r) => (
                <Link key={r.id} href={`/news/${r.id}`} className="group">
                  {r.thumbnail_url ? (
                    <img
                      src={r.thumbnail_url}
                      alt={r.title}
                      className="w-full aspect-video object-cover mb-2 group-hover:opacity-80 transition-opacity"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-line/40 mb-2" />
                  )}
                  <p className="text-sm font-medium leading-snug group-hover:underline line-clamp-2">
                    {r.title}
                  </p>
                  {r.published_at && (
                    <p className="mt-1 text-xs text-muted">
                      {new Date(r.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 푸터 */}
      <footer className="mt-12 border-t-2 border-ink py-5">
        <div className="mx-auto max-w-4xl px-4 flex items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} {siteName}</span>
          <Link href="/login" className="hover:text-ink">편집국 로그인</Link>
        </div>
      </footer>
    </div>
  )
}
