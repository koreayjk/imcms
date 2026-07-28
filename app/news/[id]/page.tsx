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
    .select(
      '*, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug), outlet:outlets(name)'
    )
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

  const [{ data: related }, { data: mostViewed }, { data: recentArticles }] = await Promise.all([
    article.category_id
      ? supabase
          .from('articles')
          .select('id, title, published_at, thumbnail_url, excerpt')
          .eq('status', 'published')
          .eq('category_id', article.category_id)
          .neq('id', article.id)
          .order('published_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    supabase
      .from('articles')
      .select('id, title, view_count')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(10),
    supabase
      .from('articles')
      .select('id, title, published_at, thumbnail_url')
      .eq('status', 'published')
      .neq('id', article.id)
      .order('published_at', { ascending: false })
      .limit(6),
  ])

  const siteName = (article.outlet as any)?.name ?? 'IM NEWS'
  const categoryName = (article.category as any)?.name
  const categorySlug = (article.category as any)?.slug
  const authorName = (article.author as any)?.full_name

  return (
    <div className="min-h-screen bg-[#f5f5f5]">

      {/* ─── 헤더 ─── */}
      <div className="bg-[#222222] text-white">
        <div className="mx-auto max-w-[1200px] px-4 h-8 flex items-center justify-between">
          <nav className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">{siteName}</Link>
            <span>/</span>
            {categoryName ? (
              <>
                <Link
                  href={`/?category=${categorySlug}`}
                  className="hover:text-white transition-colors"
                >
                  {categoryName}
                </Link>
                <span>/</span>
                <span className="text-gray-500 truncate max-w-[200px]">{article.title}</span>
              </>
            ) : (
              <span className="text-gray-500">기사</span>
            )}
          </nav>
          <Link href="/login" className="text-[11px] text-gray-400 hover:text-white transition-colors">
            편집국 로그인
          </Link>
        </div>
      </div>

      <div className="bg-white border-b border-[#dddddd]">
        <div className="mx-auto max-w-[1200px] px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="text-[28px] font-bold text-[#111] hover:opacity-80 transition-opacity">
            {siteName}
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-[#888]">
            <Link href="/" className="hover:text-navy transition-colors">← 목록</Link>
            {categoryName && (
              <Link href={`/?category=${categorySlug}`} className="hover:text-navy transition-colors">
                {categoryName}
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="bg-navy h-[3px]" />

      {/* ─── 본문 ─── */}
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="flex gap-5">

          {/* 기사 영역 (70%) */}
          <main className="flex-[7] min-w-0 bg-white border border-[#dddddd] p-5 md:p-7">

            {/* 카테고리 + 제목 */}
            {categoryName && (
              <div className="mb-2">
                <Link
                  href={`/?category=${categorySlug}`}
                  className="text-[11px] font-bold text-accent uppercase tracking-wide"
                >
                  [{categoryName}]
                </Link>
              </div>
            )}

            <h1 className="text-[24px] md:text-[27px] font-bold leading-tight text-[#111] mb-3">
              {article.title}
            </h1>

            {/* 리드문 */}
            {article.excerpt && (
              <p className="text-[14px] text-[#555] bg-[#f8f8f8] border-l-4 border-navy pl-3.5 py-2 mb-4 leading-relaxed">
                {article.excerpt}
              </p>
            )}

            {/* 메타 정보 바 */}
            <div className="flex items-center justify-between gap-3 py-2.5 mb-4 border-y border-[#eeeeee] text-[12px] text-[#888]">
              <div className="flex items-center gap-3">
                {authorName && (
                  <span className="text-[#444] font-medium">{authorName} 기자</span>
                )}
                {article.published_at && (
                  <>
                    <span>|</span>
                    <time dateTime={article.published_at}>
                      {new Date(article.published_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                      })}
                      {' '}
                      {new Date(article.published_at).toLocaleTimeString('ko-KR', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </time>
                  </>
                )}
                {article.view_count > 0 && (
                  <>
                    <span>|</span>
                    <span>조회 {article.view_count.toLocaleString()}</span>
                  </>
                )}
              </div>
              <ShareButton title={article.title} />
            </div>

            {/* 대표 이미지 */}
            {article.thumbnail_url && (
              <figure className="mb-6 text-center">
                <img
                  src={article.thumbnail_url}
                  alt={article.title}
                  className="max-w-full inline-block"
                />
              </figure>
            )}

            {/* 본문 */}
            <div className="text-[15px] leading-[2] text-[#222] whitespace-pre-wrap min-h-[200px]">
              {article.body}
            </div>

            {/* 태그 */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 pt-4 border-t border-[#eeeeee] flex flex-wrap gap-2">
                <span className="text-[12px] text-[#888] font-medium mr-1">태그:</span>
                {article.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="border border-[#ddd] rounded px-2.5 py-0.5 text-[12px] text-[#666] hover:border-navy hover:text-navy cursor-default transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 기자 정보 박스 */}
            {authorName && (
              <div className="mt-6 p-3 bg-[#f8f8f8] border border-[#eee] text-[12px] text-[#555] flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-navy/10 text-navy flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                  기
                </span>
                <div>
                  <p className="font-bold text-[#222]">{authorName} 기자</p>
                  {categoryName && <p className="text-[#888]">{categoryName} 담당</p>}
                </div>
              </div>
            )}

            {/* 하단 네비 */}
            <div className="mt-6 pt-4 border-t-2 border-navy flex items-center justify-between">
              <Link href="/" className="text-[13px] text-[#666] hover:text-navy transition-colors">
                ← 목록으로
              </Link>
              {categoryName && (
                <Link
                  href={`/?category=${categorySlug}`}
                  className="text-[13px] text-navy hover:underline"
                >
                  {categoryName} 더보기 →
                </Link>
              )}
            </div>

            {/* 관련 기사 */}
            {related && related.length > 0 && (
              <section className="mt-8 pt-5 border-t border-[#eeeeee]">
                <h2 className="section-title">관련 기사</h2>
                <ul className="divide-y divide-[#eeeeee]">
                  {related.map((r) => (
                    <li key={r.id} className="py-3 flex gap-3">
                      {r.thumbnail_url ? (
                        <Link href={`/news/${r.id}`} className="flex-shrink-0">
                          <img
                            src={r.thumbnail_url}
                            alt={r.title}
                            className="w-[88px] h-[60px] object-cover hover:opacity-90 transition-opacity"
                          />
                        </Link>
                      ) : (
                        <div className="w-[88px] h-[60px] bg-[#f0f0f0] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <Link href={`/news/${r.id}`}>
                          <p className="text-[14px] font-bold text-[#111] hover:text-navy transition-colors line-clamp-2">
                            {r.title}
                          </p>
                        </Link>
                        {r.published_at && (
                          <p className="mt-1 text-[11px] text-[#aaa]">
                            {new Date(r.published_at).toLocaleDateString('ko-KR', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </main>

          {/* 사이드바 (30%) */}
          <aside className="flex-[3] min-w-0 hidden lg:block space-y-4">

            {/* 많이 본 기사 */}
            {mostViewed && mostViewed.length > 0 && (
              <div className="bg-white border border-[#dddddd] p-3">
                <h3 className="section-title-sm">많이 본 기사</h3>
                <ol className="space-y-2.5">
                  {mostViewed.map((a, i) => (
                    <li key={a.id} className="flex gap-2.5 items-start">
                      <span
                        className={`flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center text-[11px] font-bold rounded-sm ${
                          i === 0 ? 'bg-accent text-white' :
                          i === 1 ? 'bg-navy text-white' :
                          i === 2 ? 'bg-[#555] text-white' :
                          'bg-[#e0e0e0] text-[#555]'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={`/news/${a.id}`}
                        className="text-[12px] text-[#222] leading-snug hover:text-navy hover:underline line-clamp-2 flex-1"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* 최신 기사 */}
            {recentArticles && recentArticles.length > 0 && (
              <div className="bg-white border border-[#dddddd] p-3">
                <h3 className="section-title-sm">최신 기사</h3>
                <div className="space-y-3">
                  {recentArticles.map((r) => (
                    <Link key={r.id} href={`/news/${r.id}`} className="group flex gap-2.5">
                      {r.thumbnail_url ? (
                        <img
                          src={r.thumbnail_url}
                          alt={r.title}
                          className="w-[60px] h-[42px] object-cover flex-shrink-0 group-hover:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-[60px] h-[42px] bg-[#f0f0f0] flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#222] leading-snug group-hover:text-navy transition-colors line-clamp-2">
                          {r.title}
                        </p>
                        {r.published_at && (
                          <p className="mt-0.5 text-[10px] text-[#aaa]">
                            {new Date(r.published_at).toLocaleDateString('ko-KR', {
                              month: '2-digit', day: '2-digit',
                            })}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 광고 영역 */}
            <div className="bg-white border border-[#dddddd] h-[250px] flex items-center justify-center">
              <span className="text-[11px] text-[#ccc]">광고 영역</span>
            </div>
          </aside>
        </div>
      </div>

      {/* ─── 푸터 ─── */}
      <footer className="mt-8 bg-[#222222] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-6 flex items-center justify-between text-[11px] text-gray-500">
          <span>© {new Date().getFullYear()} {siteName}. All rights reserved.</span>
          <Link href="/login" className="hover:text-gray-300 transition-colors">편집국 로그인</Link>
        </div>
      </footer>
    </div>
  )
}
