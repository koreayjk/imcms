import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ShareButton from './ShareButton'

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
        .select('id, title, published_at, thumbnail_url, excerpt')
        .eq('status', 'published')
        .eq('category_id', article.category_id)
        .neq('id', article.id)
        .order('published_at', { ascending: false })
        .limit(4)
    : { data: [] }

  // 최신 기사 (사이드바)
  const { data: recentArticles } = await supabase
    .from('articles')
    .select('id, title, published_at, thumbnail_url')
    .eq('status', 'published')
    .neq('id', article.id)
    .order('published_at', { ascending: false })
    .limit(6)

  const siteName = (article.outlet as any)?.name ?? 'IM NEWS'
  const categoryName = (article.category as any)?.name
  const categorySlug = (article.category as any)?.slug
  const authorName = (article.author as any)?.full_name

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header>
        <div className="bg-navy text-white">
          <div className="mx-auto max-w-[1100px] px-4 h-9 flex items-center justify-between">
            <nav className="flex items-center gap-2 text-xs text-gray-400">
              <Link href="/" className="hover:text-white transition-colors">{siteName}</Link>
              {categoryName && (
                <>
                  <span>/</span>
                  <Link href={`/?category=${categorySlug}`} className="hover:text-white transition-colors">
                    {categoryName}
                  </Link>
                </>
              )}
            </nav>
            <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">
              편집국 로그인 →
            </Link>
          </div>
        </div>
        <div className="bg-white border-b-2 border-ink">
          <div className="mx-auto max-w-[1100px] px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
              {siteName}
            </Link>
            <Link href="/" className="text-xs text-muted hover:text-ink transition-colors">
              ← 목록으로
            </Link>
          </div>
        </div>
      </header>

      {/* 본문 영역 */}
      <div className="mx-auto max-w-[1100px] px-4 py-7">
        <div className="flex gap-8">

          {/* 기사 본문 */}
          <article className="flex-1 min-w-0 max-w-[720px]">
            {/* 카테고리 배지 */}
            {categoryName && (
              <Link
                href={`/?category=${categorySlug}`}
                className="inline-block text-xs font-bold uppercase tracking-widest text-review hover:opacity-80 mb-3"
              >
                {categoryName}
              </Link>
            )}

            {/* 제목 */}
            <h1 className="text-[26px] md:text-3xl font-bold leading-tight mb-4">
              {article.title}
            </h1>

            {/* 리드문 */}
            {article.excerpt && (
              <p className="text-base text-muted border-l-[3px] border-review pl-4 mb-5 leading-relaxed">
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
              <div className="ml-auto">
                <ShareButton title={article.title} />
              </div>
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
            <div className="text-[16px] leading-[1.9] text-ink whitespace-pre-wrap font-serif">
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

            {/* 목록으로 */}
            <div className="mt-8 pt-5 border-t-2 border-ink flex items-center justify-between">
              <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">
                ← 목록으로
              </Link>
              {categoryName && (
                <Link
                  href={`/?category=${categorySlug}`}
                  className="text-sm text-review hover:opacity-80 transition-opacity"
                >
                  {categoryName} 더보기 →
                </Link>
              )}
            </div>

            {/* 관련 기사 */}
            {related && related.length > 0 && (
              <section className="mt-10 pt-6 border-t border-line">
                <h2 className="section-title">관련 기사</h2>
                <div className="grid grid-cols-2 gap-5">
                  {related.map((r) => (
                    <Link key={r.id} href={`/news/${r.id}`} className="group flex gap-3">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt={r.title}
                          className="w-20 h-14 object-cover flex-shrink-0 group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-20 h-14 bg-line/40 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug group-hover:text-review transition-colors line-clamp-3">
                          {r.title}
                        </p>
                        {r.published_at && (
                          <p className="mt-1 text-[11px] text-muted">
                            {new Date(r.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* 우측 사이드바 — 최신 기사 */}
          <aside className="w-[220px] flex-shrink-0 hidden lg:block">
            {recentArticles && recentArticles.length > 0 && (
              <div className="sticky top-[49px]">
                <h3 className="section-title-sm">최신 기사</h3>
                <div className="space-y-4">
                  {recentArticles.map((r) => (
                    <Link key={r.id} href={`/news/${r.id}`} className="group flex gap-3">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt={r.title}
                          className="w-16 h-11 object-cover flex-shrink-0 group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-16 h-11 bg-line/40 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium leading-snug group-hover:text-review transition-colors line-clamp-3">
                          {r.title}
                        </p>
                        {r.published_at && (
                          <p className="mt-0.5 text-[10px] text-muted">
                            {new Date(r.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="mt-14 bg-navy text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-8 flex items-center justify-between text-xs text-gray-500">
          <span>© {new Date().getFullYear()} {siteName}</span>
          <Link href="/login" className="hover:text-gray-300 transition-colors">편집국 로그인</Link>
        </div>
      </footer>
    </div>
  )
}
