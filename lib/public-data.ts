import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { demoArticles } from './demo-articles'
import { resolveSite, type SiteConfig } from './sites'
import { normalizeLayout, type SlotKey } from './home-layout'

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

export function currentSite() {
  return resolveSite(headers().get('host'))
}

const LIST_FIELDS =
  'id, title, excerpt, thumbnail_url, published_at, view_count, is_featured, tags, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)'

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
    author_name: row.author?.full_name ?? null,
    category: row.category ?? null,
    tags: row.tags ?? null,
    meta_title: row.meta_title ?? null,
    meta_description: row.meta_description ?? null,
  }
}

async function outletScope(site: SiteConfig) {
  const supabase = client()
  const { data: outlet } = await supabase
    .from('outlets').select('id').in('domain', site.domains).limit(1).maybeSingle()
  if (!outlet) return null
  const { data: cats } = await supabase
    .from('categories').select('id, slug').eq('outlet_id', outlet.id)
  const catIds = Object.fromEntries((cats ?? []).map((c) => [c.slug, c.id as string]))
  return { supabase, outletId: outlet.id as string, catIds }
}

function published(scope: NonNullable<Awaited<ReturnType<typeof outletScope>>>) {
  return scope.supabase
    .from('articles')
    .select(LIST_FIELDS, { count: 'exact' })
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
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
    .from('articles').select('id, outlet:outlets(name, domain)').eq('id', sourceId).eq('status', 'published').maybeSingle()
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
    .select(`${LIST_FIELDS}, body, category_id, meta_title, meta_description`)
    .eq('id', id)
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
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
