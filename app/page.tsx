import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import NewspaperHeader from '@/components/NewspaperHeader'

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

type SearchParams = { category?: string }

export default async function NewspaperHomePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = anonClient()
  const categorySlug = searchParams.category

  const { data: outlets } = await supabase.from('outlets').select('*').limit(1)
  const outlet = outlets?.[0]
  const siteName = outlet?.name ?? 'IM NEWS'

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  let catId: string | undefined
  if (categorySlug && categories) {
    catId = categories.find((c) => c.slug === categorySlug)?.id
  }

  let query = supabase
    .from('articles')
    .select('id, title, excerpt, thumbnail_url, published_at, is_featured, view_count, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (catId) query = query.eq('category_id', catId)

  const { data: articles } = await query.limit(30)

  const { data: mostViewed } = await supabase
    .from('articles')
    .select('id, title, view_count, published_at')
    .eq('status', 'published')
    .order('view_count', { ascending: false })
    .limit(8)

  const featured = articles?.filter((a) => a.is_featured) ?? []
  const mainFeature = featured[0] ?? articles?.[0]
  const sideFeatures = (featured.length > 1 ? featured.slice(1) : articles?.slice(1))?.slice(0, 4) ?? []
  const latestArticles = articles?.slice(mainFeature ? 5 : 0) ?? []

  return (
    <div className="min-h-screen bg-white">
      <NewspaperHeader
        siteName={siteName}
        categories={categories ?? []}
        currentCategorySlug={categorySlug}
      />

      <div className="mx-auto max-w-[1100px] px-4 py-6">

        {/* 빈 상태 */}
        {!articles?.length && (
          <div className="py-24 text-center text-muted">
            <p className="text-lg">아직 발행된 기사가 없습니다.</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-ink hover:underline">
              기자로 참여하기 →
            </Link>
          </div>
        )}

        {/* 콘텐츠 + 사이드바 */}
        <div className="flex gap-7">

          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">

            {/* 톱 기사 영역 */}
            {mainFeature && (
              <section className="mb-7 pb-7 border-b-2 border-ink">
                <div className="flex gap-6">

                  {/* 메인 피처 기사 (3/5) */}
                  <div className="flex-[3] min-w-0">
                    {mainFeature.thumbnail_url && (
                      <Link href={`/news/${mainFeature.id}`}>
                        <img
                          src={mainFeature.thumbnail_url}
                          alt={mainFeature.title}
                          className="w-full aspect-[16/10] object-cover mb-3 hover:opacity-95 transition-opacity"
                        />
                      </Link>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      {(mainFeature.category as any)?.name && (
                        <Link
                          href={`/?category=${(mainFeature.category as any).slug}`}
                          className="text-xs font-bold uppercase tracking-wider text-review hover:opacity-80"
                        >
                          {(mainFeature.category as any).name}
                        </Link>
                      )}
                      {mainFeature.is_featured && (
                        <span className="text-xs font-bold text-accent">● 주요</span>
                      )}
                    </div>
                    <Link href={`/news/${mainFeature.id}`}>
                      <h2 className="text-[22px] font-bold leading-snug hover:text-review transition-colors">
                        {mainFeature.title}
                      </h2>
                    </Link>
                    {mainFeature.excerpt && (
                      <p className="mt-2 text-sm text-muted leading-relaxed line-clamp-3">
                        {mainFeature.excerpt}
                      </p>
                    )}
                    <div className="mt-2.5 text-xs text-muted flex items-center gap-2">
                      {(mainFeature.author as any)?.full_name && (
                        <span className="font-medium text-ink">{(mainFeature.author as any).full_name}</span>
                      )}
                      {mainFeature.published_at && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(mainFeature.published_at).toLocaleDateString('ko-KR', {
                              month: 'long', day: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 사이드 기사들 (2/5) */}
                  <div className="flex-[2] min-w-0 divide-y divide-line">
                    {sideFeatures.map((a) => (
                      <div key={a.id} className="py-3.5 first:pt-0">
                        <div className="flex gap-3">
                          {a.thumbnail_url && (
                            <Link href={`/news/${a.id}`} className="flex-shrink-0">
                              <img
                                src={a.thumbnail_url}
                                alt={a.title}
                                className="w-[90px] h-[60px] object-cover hover:opacity-90 transition-opacity"
                              />
                            </Link>
                          )}
                          <div className="flex-1 min-w-0">
                            {(a.category as any)?.name && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-review">
                                {(a.category as any).name}
                              </span>
                            )}
                            <Link href={`/news/${a.id}`}>
                              <h3 className="mt-0.5 text-[13px] font-bold leading-snug hover:text-review line-clamp-3">
                                {a.title}
                              </h3>
                            </Link>
                            <p className="mt-1 text-[11px] text-muted">
                              {a.published_at &&
                                new Date(a.published_at).toLocaleDateString('ko-KR', {
                                  month: 'short', day: 'numeric',
                                })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* 최신 기사 그리드 */}
            {latestArticles.length > 0 && (
              <section>
                <h2 className="section-title">최신 기사</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {latestArticles.slice(0, 12).map((a) => (
                    <article key={a.id} className="group">
                      {a.thumbnail_url ? (
                        <Link href={`/news/${a.id}`}>
                          <img
                            src={a.thumbnail_url}
                            alt={a.title}
                            className="w-full aspect-video object-cover mb-2.5 group-hover:opacity-90 transition-opacity"
                          />
                        </Link>
                      ) : (
                        <div className="w-full aspect-video bg-line/40 mb-2.5 flex items-center justify-center">
                          <span className="text-xs text-muted">이미지 없음</span>
                        </div>
                      )}
                      {(a.category as any)?.name && (
                        <Link
                          href={`/?category=${(a.category as any).slug}`}
                          className="text-[10px] font-bold uppercase tracking-wider text-review hover:opacity-80"
                        >
                          {(a.category as any).name}
                        </Link>
                      )}
                      <Link href={`/news/${a.id}`}>
                        <h3 className="mt-0.5 text-[14px] font-bold leading-snug group-hover:text-review transition-colors line-clamp-2">
                          {a.title}
                        </h3>
                      </Link>
                      {a.excerpt && (
                        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{a.excerpt}</p>
                      )}
                      <div className="mt-1.5 text-[11px] text-muted">
                        {(a.author as any)?.full_name}
                        {a.published_at && (
                          <span className="ml-1">
                            · {new Date(a.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 우측 사이드바 */}
          <aside className="w-[220px] flex-shrink-0 hidden lg:block">

            {/* 많이 본 기사 */}
            {mostViewed && mostViewed.length > 0 && (
              <div className="mb-6">
                <h3 className="section-title-sm">많이 본 기사</h3>
                <ol className="space-y-3">
                  {mostViewed.map((a, i) => (
                    <li key={a.id} className="flex gap-2.5 items-start">
                      <span
                        className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                          i < 3 ? 'bg-review' : 'bg-muted'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <Link
                        href={`/news/${a.id}`}
                        className="text-[13px] font-medium leading-snug hover:text-review transition-colors line-clamp-2"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* 카테고리 바로가기 */}
            {categories && categories.length > 0 && (
              <div className="border-t border-line pt-4">
                <h3 className="section-title-sm">카테고리</h3>
                <ul className="space-y-1.5">
                  <li>
                    <Link
                      href="/"
                      className={`text-[13px] hover:text-review transition-colors ${
                        !categorySlug ? 'font-bold text-ink' : 'text-muted'
                      }`}
                    >
                      전체
                    </Link>
                  </li>
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        href={`/?category=${cat.slug}`}
                        className={`text-[13px] hover:text-review transition-colors ${
                          categorySlug === cat.slug ? 'font-bold text-ink' : 'text-muted'
                        }`}
                      >
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="mt-14 bg-navy text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-8">
          <div className="flex items-start justify-between gap-8 mb-6">
            <div>
              <p className="text-xl font-bold mb-1">{siteName}</p>
              {outlet?.domain && <p className="text-xs text-gray-400">{outlet.domain}</p>}
            </div>
            <Link href="/login" className="text-xs text-gray-400 hover:text-white transition-colors">
              편집국 로그인 →
            </Link>
          </div>
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 mb-5 border-t border-white/10 pt-5">
              {categories.map((cat) => (
                <Link key={cat.id} href={`/?category=${cat.slug}`} className="hover:text-gray-300 transition-colors">
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-600">
            © {new Date().getFullYear()} {siteName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
