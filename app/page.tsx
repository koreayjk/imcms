import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import NewspaperHeader from '@/components/NewspaperHeader'

// 익명 클라이언트 — 발행된 기사만 읽기
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

  // 매체 정보 (첫 번째 outlet 사용)
  const { data: outlets } = await supabase.from('outlets').select('*').limit(1)
  const outlet = outlets?.[0]
  const siteName = outlet?.name ?? 'IM NEWS'

  // 카테고리 목록
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  // 카테고리 필터
  let catId: string | undefined
  if (categorySlug && categories) {
    catId = categories.find((c) => c.slug === categorySlug)?.id
  }

  // 기사 조회 (발행됨만)
  let query = supabase
    .from('articles')
    .select('id, title, excerpt, thumbnail_url, published_at, is_featured, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (catId) query = query.eq('category_id', catId)

  const { data: articles } = await query.limit(30)

  const featured = articles?.filter((a) => a.is_featured) ?? []
  const mainFeature = featured[0] ?? articles?.[0]
  const sideFeatures = (featured.length > 1 ? featured.slice(1) : articles?.slice(1))?.slice(0, 3) ?? []
  const gridArticles = articles?.slice(mainFeature ? 4 : 0, 16) ?? []

  return (
    <div className="min-h-screen bg-paper">
      <NewspaperHeader
        siteName={siteName}
        categories={categories ?? []}
        currentCategorySlug={categorySlug}
      />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 빈 상태 */}
        {!articles?.length && (
          <div className="py-24 text-center text-muted">
            <p className="text-lg">아직 발행된 기사가 없습니다.</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-ink hover:underline">
              기자로 참여하기 →
            </Link>
          </div>
        )}

        {/* 톱 기사 영역 */}
        {mainFeature && (
          <section className="mb-8 pb-8 border-b-2 border-ink">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 메인 기사 (2/3) */}
              <div className="md:col-span-2 border-r border-line pr-6">
                {mainFeature.thumbnail_url && (
                  <img
                    src={mainFeature.thumbnail_url}
                    alt={mainFeature.title}
                    className="w-full aspect-video object-cover mb-4"
                  />
                )}
                <div className="mb-1.5">
                  {(mainFeature.category as any)?.name && (
                    <span className="text-xs font-semibold uppercase tracking-wider text-review">
                      {(mainFeature.category as any).name}
                    </span>
                  )}
                  {mainFeature.is_featured && (
                    <span className="ml-2 text-xs text-draft font-bold">★ 주요</span>
                  )}
                </div>
                <Link href={`/news/${mainFeature.id}`}>
                  <h2 className="text-2xl font-bold leading-snug hover:underline mb-2">
                    {mainFeature.title}
                  </h2>
                </Link>
                {mainFeature.excerpt && (
                  <p className="text-sm text-muted leading-relaxed line-clamp-3">
                    {mainFeature.excerpt}
                  </p>
                )}
                <div className="mt-3 text-xs text-muted flex items-center gap-2">
                  <span>{(mainFeature.author as any)?.full_name}</span>
                  {mainFeature.published_at && (
                    <>
                      <span>·</span>
                      <span>{new Date(mainFeature.published_at).toLocaleDateString('ko-KR')}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 사이드 기사들 (1/3) */}
              <div className="space-y-5">
                {sideFeatures.map((a, i) => (
                  <div key={a.id} className={i < sideFeatures.length - 1 ? 'pb-5 border-b border-line' : ''}>
                    {(a.category as any)?.name && (
                      <span className="text-xs font-semibold uppercase tracking-wider text-review">
                        {(a.category as any).name}
                      </span>
                    )}
                    <Link href={`/news/${a.id}`}>
                      <h3 className="mt-1 text-base font-bold leading-snug hover:underline">
                        {a.title}
                      </h3>
                    </Link>
                    {a.excerpt && (
                      <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                        {a.excerpt}
                      </p>
                    )}
                    <div className="mt-1.5 text-xs text-muted">
                      {(a.author as any)?.full_name}
                      {a.published_at && <span className="ml-1.5">· {new Date(a.published_at).toLocaleDateString('ko-KR')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 최신 기사 그리드 */}
        {gridArticles.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest border-b-2 border-ink pb-1.5 mb-5">
              최신 기사
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {gridArticles.map((a) => (
                <article key={a.id} className="group">
                  {a.thumbnail_url ? (
                    <Link href={`/news/${a.id}`}>
                      <img
                        src={a.thumbnail_url}
                        alt={a.title}
                        className="w-full aspect-video object-cover mb-3 group-hover:opacity-90 transition-opacity"
                      />
                    </Link>
                  ) : (
                    <div className="w-full aspect-video bg-line/40 mb-3 flex items-center justify-center">
                      <span className="text-xs text-muted">이미지 없음</span>
                    </div>
                  )}
                  {(a.category as any)?.name && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-review">
                      {(a.category as any).name}
                    </span>
                  )}
                  <Link href={`/news/${a.id}`}>
                    <h3 className="mt-1 text-sm font-bold leading-snug hover:underline line-clamp-3">
                      {a.title}
                    </h3>
                  </Link>
                  {a.excerpt && (
                    <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">
                      {a.excerpt}
                    </p>
                  )}
                  <div className="mt-1.5 text-xs text-muted">
                    {(a.author as any)?.full_name}
                    {a.published_at && (
                      <span className="ml-1">· {new Date(a.published_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 푸터 */}
      <footer className="mt-12 border-t-2 border-ink py-6">
        <div className="mx-auto max-w-6xl px-4 flex items-center justify-between text-xs text-muted">
          <span>© {new Date().getFullYear()} {siteName}</span>
          {outlet?.domain && <span>{outlet.domain}</span>}
          <Link href="/login" className="hover:text-ink">편집국 로그인</Link>
        </div>
      </footer>
    </div>
  )
}
