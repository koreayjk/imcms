import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { demoArticles } from './demo-articles'
import { SITES, buildSite, resolveSite, type CategoryRow, type OutletRow, type SiteConfig } from './sites'
import { normalizeLayout, type SlotKey } from './home-layout'
import { INDEX_WEEKS, type IndexKey, type IndexSeries } from './market-index'

export type PublicArticle = {
  id: string
  title: string
  excerpt: string | null
  body?: string
  thumbnail_url: string | null
  published_at: string | null
  view_count: number
  is_featured: boolean
  author_name: string | null
  category: { name: string; slug: string } | null
  tags: string[] | null
  meta_title?: string | null
  meta_description?: string | null
}

export const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL

// 도메인이 연결되지 않은 주소(imcms.vercel.app 등)에서 기본으로 보여줄 매체
const DEFAULT_DOMAIN = 'thecaretimes.net'
export const PREVIEW_COOKIE = 'im_site_preview'

// 매체 설정은 5분 동안 기억한다 (홈페이지 설정을 저장하면 바로 새로 읽는다)
const loadSite = unstable_cache(
  async (host: string, previewId: string | null): Promise<SiteConfig | null> => {
    const supabase = client()
    const bare = host.replace(/^www\./, '')
    let { data: outlet } = await supabase.from('outlets').select('*').eq('domain', bare).limit(1).maybeSingle()
    let preview = false
    if (!outlet && previewId) {
      ;({ data: outlet } = await supabase.from('outlets').select('*').eq('id', previewId).maybeSingle())
      preview = !!outlet
    }
    if (!outlet) ({ data: outlet } = await supabase.from('outlets').select('*').eq('domain', DEFAULT_DOMAIN).limit(1).maybeSingle())
    if (!outlet) return null
    const { data: cats } = await supabase.from('categories').select('*').eq('outlet_id', outlet.id)
    return buildSite(outlet as OutletRow, (cats ?? []) as CategoryRow[], preview)
  },
  ['public-site'],
  { revalidate: 300, tags: ['sites'] }
)

export async function currentSite(): Promise<SiteConfig> {
  if (isDemo) return SITES[0]
  const host = (headers().get('host') ?? '').split(':')[0].toLowerCase()
  const previewId = cookies().get(PREVIEW_COOKIE)?.value ?? null
  try {
    return (await loadSite(host, /^[0-9a-f-]{36}$/.test(previewId ?? '') ? previewId : null)) ?? resolveSite(host)
  } catch {
    return resolveSite(host)
  }
}

const LIST_FIELDS =
  'id, title, excerpt, thumbnail_url, published_at, view_count, is_featured, tags, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)'

// article-manage.sql 실행 전 DB에는 byline 칸이 없으므로, 있을 때만 가져온다 (5분마다 다시 확인)
let bylineCheck: { at: number; ok: boolean } | null = null
async function listFields(supabase: ReturnType<typeof client>) {
  if (!bylineCheck || Date.now() - bylineCheck.at > 300_000) {
    const { error } = await supabase.from('articles').select('byline').limit(1)
    bylineCheck = { at: Date.now(), ok: !error }
  }
  return bylineCheck.ok ? `${LIST_FIELDS}, byline` : LIST_FIELDS
}

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function toPublic(row: any): PublicArticle {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    thumbnail_url: row.thumbnail_url,
    published_at: row.published_at,
    view_count: row.view_count ?? 0,
    is_featured: row.is_featured,
    author_name: row.byline?.trim() || row.author?.full_name || null,
    category: row.category ?? null,
    tags: row.tags ?? null,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
  }
}

async function outletScope(site: SiteConfig) {
  const supabase = client()
  const { data: outlet } = site.outletId
    ? { data: { id: site.outletId } }
    : await supabase.from('outlets').select('id').in('domain', site.domains).limit(1).maybeSingle()
  if (!outlet) return null
  const { data: cats } = await supabase
    .from('categories').select('id, slug').eq('outlet_id', outlet.id)
  const catIds = Object.fromEntries((cats ?? []).map((c) => [c.slug, c.id as string]))
  // 칸 목록이 실행 중에 정해지므로 타입 추론 대신 any 행으로 다룬다
  return { supabase, outletId: outlet.id as string, catIds, fields: (await listFields(supabase)) as '*' }
}

function published(scope: NonNullable<Awaited<ReturnType<typeof outletScope>>>) {
  return scope.supabase
    .from('articles')
    .select(scope.fields, { count: 'exact' })
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
    // 예약 발행: 공개 시각이 지난 기사만 (DB에서도 막는다, scheduled-publish.sql)
    .lte('published_at', new Date().toISOString())
}

export type HomeData = {
  latest: PublicArticle[]
  mostViewed: PublicArticle[]
  bySection: Record<string, PublicArticle[]>
  pinned: Record<SlotKey, (PublicArticle | null)[]>
}

const emptyPinned = () => normalizeLayout({}) as unknown as Record<SlotKey, (PublicArticle | null)[]>

// 편집판에서 고정한 기사들 (home_layouts 표가 아직 없으면 전부 빈 자리)
async function pinnedArticles(scope: NonNullable<Awaited<ReturnType<typeof outletScope>>>) {
  const { data } = await scope.supabase.from('home_layouts').select('layout').eq('outlet_id', scope.outletId).maybeSingle()
  const layout = normalizeLayout(data?.layout)
  const ids = Array.from(new Set(Object.values(layout).flat().filter((x): x is string => !!x)))
  if (!ids.length) return emptyPinned()
  const { data: rows } = await published(scope).in('id', ids)
  const byId = new Map((rows ?? []).map((r) => [r.id as string, toPublic(r)]))
  return Object.fromEntries(
    Object.entries(layout).map(([k, list]) => [k, list.map((id) => (id ? byId.get(id) ?? null : null))])
  ) as Record<SlotKey, (PublicArticle | null)[]>
}

export async function getHomeData(site: SiteConfig): Promise<HomeData> {
  if (isDemo) {
    const all = demoArticles()
    const bySection = Object.fromEntries(
      site.sections.map((s) => [s.slug, all.filter((a) => a.category?.slug === s.slug)])
    )
    return {
      latest: all.slice(0, 24),
      mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8),
      bySection,
      pinned: emptyPinned(),
    }
  }

  const scope = await outletScope(site)
  if (!scope) return { latest: [], mostViewed: [], bySection: {}, pinned: emptyPinned() }

  const [pinned, latest, mostViewed, ...sections] = await Promise.all([
    pinnedArticles(scope),
    published(scope).order('published_at', { ascending: false }).limit(24),
    published(scope).order('view_count', { ascending: false }).limit(8),
    ...site.sections.map((s) =>
      scope.catIds[s.slug]
        ? published(scope).eq('category_id', scope.catIds[s.slug]).order('published_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] as any[] })
    ),
  ])

  return {
    pinned,
    latest: (latest.data ?? []).map(toPublic),
    mostViewed: (mostViewed.data ?? []).map(toPublic),
    bySection: Object.fromEntries(site.sections.map((s, i) => [s.slug, (sections[i].data ?? []).map(toPublic)])),
  }
}

export const SECTION_PAGE_SIZE = 15

export async function getSectionData(site: SiteConfig, slug: string, page: number) {
  const from = (page - 1) * SECTION_PAGE_SIZE
  if (isDemo) {
    const all = demoArticles()
    const list = all.filter((a) => a.category?.slug === slug)
    return {
      articles: list.slice(from, from + SECTION_PAGE_SIZE),
      total: list.length,
      mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8),
    }
  }

  const scope = await outletScope(site)
  const catId = scope?.catIds[slug]
  if (!scope || !catId) return { articles: [], total: 0, mostViewed: [] }

  const [list, mostViewed] = await Promise.all([
    published(scope).eq('category_id', catId).order('published_at', { ascending: false }).range(from, from + SECTION_PAGE_SIZE - 1),
    published(scope).order('view_count', { ascending: false }).limit(8),
  ])
  return {
    articles: (list.data ?? []).map(toPublic),
    total: list.count ?? 0,
    mostViewed: (mostViewed.data ?? []).map(toPublic),
  }
}

export async function searchArticles(site: SiteConfig, q: string) {
  const term = q.trim()
  if (!term) return []
  if (isDemo) return demoArticles().filter((a) => a.title.includes(term)).slice(0, 30)

  const scope = await outletScope(site)
  if (!scope) return []
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const { data } = await published(scope).ilike('title', pattern).order('published_at', { ascending: false }).limit(30)
  return (data ?? []).map(toPublic)
}

export type ArticleSource = { id: string; outletName: string; url: string | null }

// 함께 송고된 사본이면 원본 매체와 원문 주소를 돌려준다 (칸이 아직 없는 DB에서도 조용히 null)
async function sourceOf(supabase: ReturnType<typeof client>, id: string): Promise<ArticleSource | null> {
  const { data: self } = await supabase.from('articles').select('source_article_id').eq('id', id).maybeSingle()
  const sourceId = (self as { source_article_id?: string | null } | null)?.source_article_id
  if (!sourceId) return null
  const { data: src } = await supabase
    .from('articles').select('id, outlet:outlets(name, domain)').eq('id', sourceId).eq('status', 'published').lte('published_at', new Date().toISOString()).maybeSingle()
  const outlet = (src as any)?.outlet as { name: string; domain: string | null } | undefined
  if (!src || !outlet) return null
  return { id: src.id, outletName: outlet.name, url: outlet.domain ? `https://${outlet.domain}/news/${src.id}` : null }
}

export async function getArticleData(site: SiteConfig, id: string) {
  if (isDemo) {
    const all = demoArticles()
    const article = all.find((a) => a.id === id)
    if (!article) return null
    return {
      source: null as ArticleSource | null,
      article,
      related: all.filter((a) => a.category?.slug === article.category?.slug && a.id !== id).slice(0, 4),
      mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8),
      latest: all.filter((a) => a.id !== id).slice(0, 5),
    }
  }

  const scope = await outletScope(site)
  if (!scope) return null
  const { data } = await scope.supabase
    .from('articles')
    .select(`${scope.fields}, body, category_id, meta_title, meta_description`)
    .eq('id', id)
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .maybeSingle()
  if (!data) return null

  const [related, mostViewed, latest, source] = await Promise.all([
    data.category_id
      ? published(scope).eq('category_id', data.category_id).neq('id', id).order('published_at', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] as any[] }),
    published(scope).order('view_count', { ascending: false }).limit(8),
    published(scope).neq('id', id).order('published_at', { ascending: false }).limit(5),
    sourceOf(scope.supabase, id),
  ])
  return {
    source,
    article: toPublic(data),
    related: (related.data ?? []).map(toPublic),
    mostViewed: (mostViewed.data ?? []).map(toPublic),
    latest: (latest.data ?? []).map(toPublic),
  }
}

// ───────── 해운 운임지수 위젯 (SCFI·KCCI) ─────────
// 편집국에서 값을 저장하면 'market-index' 태그로 바로 새로 읽는다. market-indices.sql 전이면 빈 값
const loadIndexSeries = unstable_cache(
  async (outletId: string): Promise<IndexSeries> => {
    const empty: IndexSeries = { scfi: [], kcci: [] }
    const { data, error } = await client()
      .from('market_index_points')
      .select('index_key, week_date, value, is_sample')
      .eq('outlet_id', outletId)
      .order('week_date', { ascending: false })
      .limit(INDEX_WEEKS * 2 * 2)
    if (error || !data) return empty
    for (const r of data as { index_key: IndexKey; week_date: string; value: number; is_sample: boolean }[]) {
      const list = empty[r.index_key]
      if (list && list.length < INDEX_WEEKS) list.push({ date: r.week_date, value: Number(r.value), sample: r.is_sample })
    }
    empty.scfi.reverse()
    empty.kcci.reverse()
    return empty
  },
  ['market-index'],
  { revalidate: 600, tags: ['market-index'] }
)

export async function getIndexSeries(site: SiteConfig): Promise<IndexSeries | null> {
  if (!site.indexWidget || !site.outletId || isDemo) return null
  try {
    const s = await loadIndexSeries(site.outletId)
    return s.scfi.length || s.kcci.length ? s : null
  } catch {
    return null
  }
}
