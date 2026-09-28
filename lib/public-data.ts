import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { demoArticles } from './demo-articles'
import { resolveSite, type SiteConfig } from './sites'

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
    }
  }

  const scope = await outletScope(site)
  if (!scope) return { latest: [], mostViewed: [], bySection: {} }

  const [latest, mostViewed, ...sections] = await Promise.all([
    published(scope).order('published_at', { ascending: false }).limit(24),
    published(scope).order('view_count', { ascending: false }).limit(8),
    ...site.sections.map((s) =>
      scope.catIds[s.slug]
        ? published(scope).eq('category_id', scope.catIds[s.slug]).order('published_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] as any[] })
    ),
  ])

  return {
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

export async function getArticleData(site: SiteConfig, id: string) {
  if (isDemo) {
    const all = demoArticles()
    const article = all.find((a) => a.id === id)
    if (!article) return null
    return {
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
    .select(`${LIST_FIELDS}, body, category_id`)
    .eq('id', id)
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
    .maybeSingle()
  if (!data) return null

  const [related, mostViewed, latest] = await Promise.all([
    data.category_id
      ? published(scope).eq('category_id', data.category_id).neq('id', id).order('published_at', { ascending: false }).limit(4)
      : Promise.resolve({ data: [] as any[] }),
    published(scope).order('view_count', { ascending: false }).limit(8),
    published(scope).neq('id', id).order('published_at', { ascending: false }).limit(5),
  ])
  return {
    article: toPublic(data),
    related: (related.data ?? []).map(toPublic),
    mostViewed: (mostViewed.data ?? []).map(toPublic),
    latest: (latest.data ?? []).map(toPublic),
  }
}
