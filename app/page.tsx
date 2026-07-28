import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import NewspaperHeader from '@/components/NewspaperHeader'
import BreakingNewsTicker from '@/components/BreakingNewsTicker'

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

  const [{ data: outlets }, { data: categories }] = await Promise.all([
    supabase.from('outlets').select('*').limit(1),
    supabase.from('categories').select('*').order('sort_order'),
  ])

  const outlet = outlets?.[0]
  const siteName = outlet?.name ?? 'IM NEWS'

  let catId: string | undefined
  if (categorySlug && categories) {
    catId = categories.find((c) => c.slug === categorySlug)?.id
  }

  let query = supabase
    .from('articles')
    .select(
      'id, title, excerpt, thumbnail_url, published_at, is_featured, view_count, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)'
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (catId) query = query.eq('category_id', catId)

  const [{ data: articles }, { data: mostViewed }, { data: tickerArticles }] = await Promise.all([
    query.limit(32),
    supabase
      .from('articles')
      .select('id, title, view_count')
      .eq('status', 'published')
      .order('view_count', { ascending: false })
      .limit(10),
    supabase
      .from('articles')
      .select('id, title')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(8),
  ])

  const featured = articles?.filter((a) => a.is_featured) ?? []
  const mainFeature = featured[0] ?? articles?.[0]
  const sideFeatures = (featured.length > 1 ? featured.slice(1) : articles?.slice(1))?.slice(0, 4) ?? []
  const latestArticles = articles?.slice(mainFeature ? 5 : 0) ?? []
  const gridArticles = latestArticles.slice(0, 12)
  const extraArticles = latestArticles.slice(12, 20)

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <NewspaperHeader
        siteName={siteName}
        categories={categories ?? []}
        currentCategorySlug={categorySlug}
      />

      {/* 속보 티커 */}
      <BreakingNewsTicker items={tickerArticles ?? []} />

      <div className="mx-auto max-w-[1200px] px-4 py-5">

        {/* 빈 상태 */}
        {!articles?.length && (
          <div className="py-24 text-center text-[#888]">
            <p className="text-lg text-[#555]">아직 발행된 기사가 없습니다.</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-navy hover:underline">
              기자로 참여하기 →
            </Link>
          </div>
        )}

        {/* ─── 톱 기사 영역 ─── */}
        {mainFeature && (
          <section className="bg-white border border-[#dddddd] p-4 mb-5">
            <div className="flex gap-5">

              {/* 메인 피처 (60%) */}
              <div className="flex-[6] min-w-0 border-r border-[#eeeeee] pr-5">
                {mainFeature.thumbnail_url && (
                  <Link href={`/news/${mainFeature.id}`}>
                    <img
                      src={mainFeature.thumbnail_url}
                      alt={mainFeature.title}
                      className="w-full aspect-[16/9] object-cover mb-3 hover:opacity-95 transition-opacity"
                    />
                  </Link>
                )}
                <div className="flex items-center gap-2 mb-1.5">
                  {(mainFeature.category as any)?.name && (
                    <Link
                      href={`/?category=${(mainFeature.category as any).slug}`}
                      className="text-[11px] font-bold text-accent uppercase tracking-wide"
                    >
                      [{(mainFeature.category as any).name}]
                    </Link>
                  )}
                  {mainFeature.is_featured && (
                    <span className="text-[11px] font-bold text-navy">★ 주요기사</span>
                  )}
                </div>
                <Link href={`/news/${mainFeature.id}`}>
                  <h2 className="text-[22px] font-bold leading-tight text-[#111] hover:text-navy transition-colors mb-2">
                    {mainFeature.title}
                  </h2>
                </Link>
                {mainFeature.excerpt && (
                  <p className="text-[14px] text-[#555] leading-relaxed line-clamp-3 mb-3">
                    {mainFeature.excerpt}
                  </p>
                )}
                <div className="flex items-center gap-2 text-[12px] text-[#888]">
                  {(mainFeature.author as any)?.full_name && (
                    <span className="text-[#444] font-medium">{(mainFeature.author as any).full_name} 기자</span>
                  )}
                  {mainFeature.published_at && (
                    <>
                      <span>|</span>
                      <time dateTime={mainFeature.published_at}>
                        {new Date(mainFeature.published_at).toLocaleDateString('ko-KR', {
                          year: 'numeric', month: '2-digit', day: '2-digit',
                        })}
                      </time>
                    </>
                  )}
                </div>
              </div>

              {/* 사이드 기사들 (40%) */}
              <div className="flex-[4] min-w-0 divide-y divide-[#eeeeee]">
                {sideFeatures.map((a) => (
                  <div key={a.id} className="py-3 first:pt-0">
                    <div className="flex gap-3">
                      {a.thumbnail_url ? (
                        <Link href={`/news/${a.id}`} className="flex-shrink-0">
                          <img
                            src={a.thumbnail_url}
                            alt={a.title}
                            className="w-[100px] h-[68px] object-cover hover:opacity-90 transition-opacity"
                          />
                        </Link>
                      ) : (
                        <div className="w-[100px] h-[68px] bg-[#f0f0f0] flex-shrink-0 flex items-center justify-center">
                          <span className="text-[10px] text-[#bbb]">이미지 없음</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {(a.category as any)?.name && (
                          <span className="text-[10px] font-bold text-accent uppercase">
                            [{(a.category as any).name}]
                          </span>
                        )}
                        <Link href={`/news/${a.id}`}>
                          <h3 className="mt-0.5 text-[13px] font-bold leading-snug text-[#111] hover:text-navy line-clamp-3">
                            {a.title}
                          </h3>
                        </Link>
                        {a.excerpt && (
                          <p className="mt-1 text-[11px] text-[#888] line-clamp-1">{a.excerpt}</p>
                        )}
                        <p className="mt-1 text-[11px] text-[#aaa]">
                          {a.published_at &&
                            new Date(a.published_at).toLocaleDateString('ko-KR', {
                              year: 'numeric', month: '2-digit', day: '2-digit',
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

        {/* ─── 메인 + 사이드바 ─── */}
        <div className="flex gap-5">

          {/* 메인 컨텐츠 (70%) */}
          <div className="flex-[7] min-w-0">

            {/* 최신 기사 그리드 */}
            {gridArticles.length > 0 && (
              <section className="mb-5">
                <h2 className="section-title">최신 기사</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {gridArticles.map((a) => (
                    <article key={a.id} className="bg-white border border-[#dddddd] group">
                      <Link href={`/news/${a.id}`}>
                        {a.thumbnail_url ? (
                          <img
                            src={a.thumbnail_url}
                            alt={a.title}
                            className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="w-full aspect-video bg-[#f0f0f0] flex items-center justify-center">
                            <span className="text-[10px] text-[#ccc]">이미지 없음</span>
                          </div>
                        )}
                      </Link>
                      <div className="p-2.5">
                        {(a.category as any)?.name && (
                          <Link
                            href={`/?category=${(a.category as any).slug}`}
                            className="text-[10px] font-bold text-accent uppercase"
                          >
                            [{(a.category as any).name}]
                          </Link>
                        )}
                        <Link href={`/news/${a.id}`}>
                          <h3 className="mt-0.5 text-[13px] font-bold leading-snug text-[#111] group-hover:text-navy transition-colors line-clamp-3">
                            {a.title}
                          </h3>
                        </Link>
                        <div className="mt-1.5 text-[11px] text-[#aaa] flex items-center gap-1.5">
                          {(a.author as any)?.full_name && (
                            <span>{(a.author as any).full_name}</span>
                          )}
                          {a.published_at && (
                            <span>
                              {new Date(a.published_at).toLocaleDateString('ko-KR', {
                                month: '2-digit', day: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {/* 추가 기사 리스트 */}
            {extraArticles.length > 0 && (
              <section className="bg-white border border-[#dddddd] p-4">
                <h2 className="section-title">더보기</h2>
                <ul className="divide-y divide-[#eeeeee]">
                  {extraArticles.map((a) => (
                    <li key={a.id} className="py-3 flex gap-3">
                      {a.thumbnail_url && (
                        <Link href={`/news/${a.id}`} className="flex-shrink-0">
                          <img
                            src={a.thumbnail_url}
                            alt={a.title}
                            className="w-[88px] h-[60px] object-cover hover:opacity-90 transition-opacity"
                          />
                        </Link>
                      )}
                      <div className="flex-1 min-w-0">
                        {(a.category as any)?.name && (
                          <span className="text-[10px] font-bold text-accent uppercase">
                            [{(a.category as any).name}]
                          </span>
                        )}
                        <Link href={`/news/${a.id}`}>
                          <h3 className="text-[14px] font-bold leading-snug text-[#111] hover:text-navy transition-colors line-clamp-2">
                            {a.title}
                          </h3>
                        </Link>
                        <div className="mt-1 text-[11px] text-[#aaa]">
                          {(a.author as any)?.full_name}
                          {a.published_at && (
                            <span className="ml-2">
                              {new Date(a.published_at).toLocaleDateString('ko-KR', {
                                year: 'numeric', month: '2-digit', day: '2-digit',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* 우측 사이드바 (30%) */}
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
                        className="text-[13px] text-[#222] leading-snug hover:text-navy hover:underline line-clamp-2 flex-1"
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
              <div className="bg-white border border-[#dddddd] p-3">
                <h3 className="section-title-sm">카테고리</h3>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <Link
                    href="/"
                    className={`text-center py-1.5 text-[12px] border rounded transition-colors ${
                      !categorySlug
                        ? 'bg-navy text-white border-navy'
                        : 'text-[#555] border-[#ddd] hover:border-navy hover:text-navy'
                    }`}
                  >
                    전체
                  </Link>
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/?category=${cat.slug}`}
                      className={`text-center py-1.5 text-[12px] border rounded transition-colors ${
                        categorySlug === cat.slug
                          ? 'bg-navy text-white border-navy'
                          : 'text-[#555] border-[#ddd] hover:border-navy hover:text-navy'
                      }`}
                    >
                      {cat.name}
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
        <div className="mx-auto max-w-[1200px] px-4 py-8">
          <div className="flex flex-wrap items-start gap-8 mb-5 pb-5 border-b border-white/10">
            <div>
              <p className="text-[18px] font-bold mb-1">{siteName}</p>
              {outlet?.domain && <p className="text-[12px] text-gray-400">{outlet.domain}</p>}
            </div>
            {categories && categories.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${cat.slug}`}
                    className="text-[12px] text-gray-400 hover:text-white transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-600">
            <p>© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <Link href="/login" className="hover:text-gray-300 transition-colors">편집국 로그인</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
