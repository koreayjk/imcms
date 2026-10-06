import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { demoArticles, demoSite } from './demo-articles'
import { SITES, buildSite, resolveSite, sectionFamily, topSections, type CategoryRow, type OutletRow, type SiteConfig } from './sites'
import { normalizeLayout, type SlotKey } from './home-layout'
import { INDEX_WEEKS, type IndexKey, type IndexSeries } from './market-index'
import { outletTag } from './outlet-cache'

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
  // 기자명 옆 이메일 (기사마다, 기본은 언론사 대표 이메일)
  author_email?: string | null
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
  if (isDemo) return demoSite()
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const previewId = (await cookies()).get(PREVIEW_COOKIE)?.value ?? null
  try {
    return (await loadSite(host, /^[0-9a-f-]{36}$/.test(previewId ?? '') ? previewId : null)) ?? resolveSite(host)
  } catch {
    return resolveSite(host)
  }
}

// 기사 미리보기용: 접속한 주소와 상관없이 그 매체의 홈페이지 설정을 쓴다 ("도메인 연결 전" 띠는 빼고)
export async function siteForOutlet(outletId: string): Promise<SiteConfig> {
  if (isDemo) return demoSite()
  const site = await loadSite('#outlet', outletId).catch(() => null)
  return site ? { ...site, preview: false } : resolveSite('')
}

const LIST_FIELDS =
  'id, title, excerpt, thumbnail_url, published_at, view_count, is_featured, tags, author:profiles!articles_author_id_fkey(full_name), category:categories(name, slug)'

// article-manage.sql 실행 전 DB에는 byline 칸이 없으므로, 있을 때만 가져온다 (5분마다 다시 확인)
// 기자 이메일(byline_email)도 newsroom-settings.sql 실행 뒤에만 있다
let bylineCheck: { at: number; ok: boolean; email: boolean } | null = null
async function listFields(supabase: ReturnType<typeof client>) {
  if (!bylineCheck || Date.now() - bylineCheck.at > 300_000) {
    const [{ error }, { error: emailError }] = await Promise.all([
      supabase.from('articles').select('byline').limit(1),
      supabase.from('articles').select('byline_email').limit(1),
    ])
    bylineCheck = { at: Date.now(), ok: !error, email: !emailError }
  }
  return `${LIST_FIELDS}${bylineCheck.ok ? ', byline' : ''}${bylineCheck.email ? ', byline_email' : ''}`
}

function client() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

// ───────── 홈페이지 데이터 캐시 ─────────
// 독자가 올 때마다 DB를 읽지 않도록 매체별로 1분 동안 기억한다
//   기사를 저장·발행·승인·삭제하거나 홈 편집판을 저장하면 그 매체 것만 바로 지운다 (app/(main)/articles/refresh.ts)
//   예약 발행 기사는 정한 시각에서 최대 1분 뒤에 보인다
const CACHE_SECONDS = 60
const cacheId = (site: SiteConfig) => site.outletId ?? site.domains[0] ?? site.key
// 섹션 구성이 바뀌면 다른 캐시를 쓴다 (2차 메뉴 묶음이 달라지므로)
const sectionsKey = (site: SiteConfig) => site.sections.map((s) => `${s.slug}<${s.parent ?? ''}`).join(',')

function outletCached<A extends unknown[], R>(name: string, load: (site: SiteConfig, ...args: A) => Promise<R>) {
  return (site: SiteConfig, ...args: A): Promise<R> => {
    if (isDemo) return load(site, ...args)
    const id = cacheId(site)
    return unstable_cache(() => load(site, ...args), ['outlet-data', name, id, sectionsKey(site), JSON.stringify(args)], {
      revalidate: CACHE_SECONDS,
      tags: [outletTag(id), 'sites'],
    })()
  }
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
    author_email: row.byline_email ?? null,
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

async function loadHomeData(site: SiteConfig): Promise<HomeData> {
  if (isDemo) {
    const all = demoArticles()
    const bySection = Object.fromEntries(
      topSections(site).map((s) => {
        const fam = sectionFamily(site, s.slug)
        return [s.slug, all.filter((a) => !!a.category && fam.includes(a.category.slug))]
      })
    )
    return {
      latest: all.slice(0, 30),
      mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8),
      bySection,
      pinned: emptyPinned(),
    }
  }

  const scope = await outletScope(site)
  if (!scope) return { latest: [], mostViewed: [], bySection: {}, pinned: emptyPinned() }
  const tops = topSections(site)

  const [pinned, latest, mostViewed, ...sections] = await Promise.all([
    pinnedArticles(scope),
    published(scope).order('published_at', { ascending: false }).limit(30),
    published(scope).order('view_count', { ascending: false }).limit(8),
    // 1차 섹션마다 (2차 메뉴 기사 포함)
    ...tops.map((s) => {
      const ids = familyIds(site, scope.catIds, s.slug)
      return ids.length
        ? published(scope).in('category_id', ids).order('published_at', { ascending: false }).limit(SECTION_HOME_LIMIT)
        : Promise.resolve({ data: [] as any[] })
    }),
  ])

  return {
    pinned,
    latest: (latest.data ?? []).map(toPublic),
    mostViewed: (mostViewed.data ?? []).map(toPublic),
    bySection: Object.fromEntries(tops.map((s, i) => [s.slug, (sections[i].data ?? []).map(toPublic)])),
  }
}
export const getHomeData = outletCached('home', loadHomeData)

export const SECTION_PAGE_SIZE = 15
// 홈에서 섹션마다 가져오는 기사 수 (섹션 띠 배치는 더 많이 쓴다)
const SECTION_HOME_LIMIT = 8

// 섹션과 그 2차 메뉴의 DB id
function familyIds(site: SiteConfig, catIds: Record<string, string>, slug: string) {
  return sectionFamily(site, slug).map((x) => catIds[x]).filter(Boolean)
}

// slug 가 null 이면 모든 섹션 (전체기사)
async function loadSectionData(site: SiteConfig, slug: string | null, page: number) {
  const from = (page - 1) * SECTION_PAGE_SIZE
  if (isDemo) {
    const all = demoArticles()
    const fam = slug ? sectionFamily(site, slug) : null
    const list = fam ? all.filter((a) => !!a.category && fam.includes(a.category.slug)) : all
    return {
      articles: list.slice(from, from + SECTION_PAGE_SIZE),
      total: list.length,
      mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8),
    }
  }

  const scope = await outletScope(site)
  const ids = slug && scope ? familyIds(site, scope.catIds, slug) : null
  if (!scope || (ids && !ids.length)) return { articles: [], total: 0, mostViewed: [] }

  const listQuery = ids ? published(scope).in('category_id', ids) : published(scope)
  const [list, mostViewed] = await Promise.all([
    listQuery.order('published_at', { ascending: false }).range(from, from + SECTION_PAGE_SIZE - 1),
    published(scope).order('view_count', { ascending: false }).limit(8),
  ])
  return {
    articles: (list.data ?? []).map(toPublic),
    total: list.count ?? 0,
    mostViewed: (mostViewed.data ?? []).map(toPublic),
  }
}
export const getSectionData = outletCached('section', loadSectionData)

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

async function loadArticleData(site: SiteConfig, id: string) {
  if (isDemo) {
    const all = demoArticles()
    const article = all.find((a) => a.id === id)
    if (!article) return null
    return {
      source: null as ArticleSource | null,
      article,
      ...splitRelated(article, all.filter((a) => a.id !== id), all.filter((a) => a.category?.slug === article.category?.slug && a.id !== id)),
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

  const tags = ((data as { tags?: string[] | null }).tags ?? []).filter(Boolean).slice(0, 10)
  const [related, tagged, mostViewed, latest, source] = await Promise.all([
    data.category_id
      ? published(scope).eq('category_id', data.category_id).neq('id', id).order('published_at', { ascending: false }).limit(4 + RELATED_LINKS)
      : Promise.resolve({ data: [] as any[] }),
    tags.length
      ? published(scope).overlaps('tags', tags).neq('id', id).order('published_at', { ascending: false }).limit(30)
      : Promise.resolve({ data: [] as any[] }),
    published(scope).order('view_count', { ascending: false }).limit(8),
    published(scope).neq('id', id).order('published_at', { ascending: false }).limit(5),
    sourceOf(scope.supabase, id),
  ])
  const article = toPublic(data)
  return {
    source,
    article,
    ...splitRelated(article, (tagged.data ?? []).map(toPublic), (related.data ?? []).map(toPublic)),
    mostViewed: (mostViewed.data ?? []).map(toPublic),
    latest: (latest.data ?? []).map(toPublic),
  }
}
export const getArticleData = outletCached('article', loadArticleData)

const RELATED_LINKS = 4
const RELATED_MIN = 3

// 겹치는 태그 수가 많은 순, 같으면 최신순 (후보는 최신순으로 들어온다)
function pickRelated(a: PublicArticle, pool: PublicArticle[]) {
  const mine = new Set((a.tags ?? []).map((t) => t.trim()).filter(Boolean))
  if (!mine.size) return []
  return pool
    .map((r, i) => ({ r, i, n: (r.tags ?? []).filter((t) => mine.has(t.trim())).length }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n || x.i - y.i)
    .slice(0, RELATED_LINKS)
    .map((x) => x.r)
}

// 관련기사: 태그가 많이 겹치는 기사 → 모자라면 같은 섹션 최신 기사. 아래 '섹션 다른 기사'(related)와는 겹치지 않게
function splitRelated(a: PublicArticle, tagged: PublicArticle[], sameSection: PublicArticle[]) {
  const relatedLinks = pickRelated(a, tagged)
  for (const r of sameSection) if (relatedLinks.length < RELATED_MIN && !relatedLinks.some((x) => x.id === r.id)) relatedLinks.push(r)
  const linkIds = new Set(relatedLinks.map((r) => r.id))
  return { relatedLinks, related: sameSection.filter((r) => !linkIds.has(r.id)).slice(0, 4) }
}

export const REPORTER_PAGE_SIZE = 15

// 기자별 기사: 기사에 적힌 기자명이 같은 기사 (기자명을 따로 적지 않은 기사는 그 이름의 작성자 계정 기사)
async function loadReporterArticles(site: SiteConfig, name: string, page: number) {
  const from = (page - 1) * REPORTER_PAGE_SIZE
  const who = name.trim().slice(0, 40)
  const empty = { articles: [] as PublicArticle[], total: 0, mostViewed: [] as PublicArticle[] }
  if (!who) return empty
  if (isDemo) {
    const all = demoArticles()
    const list = all.filter((a) => a.author_name === who)
    return { articles: list.slice(from, from + REPORTER_PAGE_SIZE), total: list.length, mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8) }
  }
  const scope = await outletScope(site)
  if (!scope) return empty
  // 홈페이지 방문자는 기사를 발행한 기자의 프로필만 읽을 수 있다
  const { data: people } = await scope.supabase.from('profiles').select('id').eq('full_name', who).limit(20)
  const ids = (people ?? []).map((p) => p.id as string)
  const hasByline = scope.fields.includes('byline')
  if (!hasByline && !ids.length) return empty
  const quoted = `"${who.replace(/["\\]/g, (c) => `\\${c}`)}"`
  const filter = hasByline
    ? [`byline.eq.${quoted}`, ...(ids.length ? [`and(byline.is.null,author_id.in.(${ids.join(',')}))`] : [])].join(',')
    : `author_id.in.(${ids.join(',')})`
  const [list, mostViewed] = await Promise.all([
    published(scope).or(filter).order('published_at', { ascending: false }).range(from, from + REPORTER_PAGE_SIZE - 1),
    published(scope).order('view_count', { ascending: false }).limit(8),
  ])
  return { articles: (list.data ?? []).map(toPublic), total: list.count ?? 0, mostViewed: (mostViewed.data ?? []).map(toPublic) }
}
export const getReporterArticles = outletCached('reporter', loadReporterArticles)

// 기사 화면 오른쪽 (많이 본 기사·최신 기사). 기사 미리보기가 쓴다
export async function getArticleSidebar(site: SiteConfig) {
  if (isDemo) {
    const all = demoArticles()
    return { mostViewed: [...all].sort((a, b) => b.view_count - a.view_count).slice(0, 8), latest: all.slice(0, 5) }
  }
  const scope = await outletScope(site)
  if (!scope) return { mostViewed: [] as PublicArticle[], latest: [] as PublicArticle[] }
  const [mostViewed, latest] = await Promise.all([
    published(scope).order('view_count', { ascending: false }).limit(8),
    published(scope).order('published_at', { ascending: false }).limit(5),
  ])
  return { mostViewed: (mostViewed.data ?? []).map(toPublic), latest: (latest.data ?? []).map(toPublic) }
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

// ───────── 사이트맵·RSS ─────────
export type FeedArticle = PublicArticle & { updated_at: string | null }

// 공개된 기사 목록 (최신순). sinceHours를 주면 그 시간 안에 공개된 기사만 (뉴스 사이트맵용)
async function loadFeedArticles(site: SiteConfig, limit: number, sinceHours?: number): Promise<FeedArticle[]> {
  if (isDemo) return demoArticles().slice(0, limit).map((a) => ({ ...a, updated_at: a.published_at }))
  const scope = await outletScope(site)
  if (!scope) return []
  let q = scope.supabase
    .from('articles')
    .select(`${scope.fields}, updated_at`)
    .eq('outlet_id', scope.outletId)
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
  if (sinceHours) q = q.gte('published_at', new Date(Date.now() - sinceHours * 3600_000).toISOString())
  const { data } = await q.order('published_at', { ascending: false }).limit(limit)
  return ((data ?? []) as any[]).map((r) => ({ ...toPublic(r), updated_at: r.updated_at ?? r.published_at }))
}
export const getFeedArticles = outletCached('feed', loadFeedArticles)

// 사이트맵·RSS에 쓰는 대표 주소 (도메인이 연결돼 있으면 그 주소, 아니면 지금 접속한 주소)
export function siteBaseUrl(site: SiteConfig, host: string | null) {
  const h = site.domains[0] ?? (host ?? '').split(',')[0].trim()
  return `https://${h}`
}
