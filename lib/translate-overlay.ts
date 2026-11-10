import { createClient } from '@supabase/supabase-js'
import type { SiteConfig } from './sites'

// 영어판("English" 버튼)으로 보는 중이면, 불러온 기사들의 제목·부제·본문과 섹션 이름을 영어 번역으로 바꾼다.
//   번역이 아직 없는 기사는 한글 그대로 둔다. 결과 안의 기사 모양 객체(id·title이 있는 것)를 모두 찾아 한꺼번에 처리한다
type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null

function walk(v: unknown, visit: (o: Obj) => void, seen: Set<unknown>) {
  if (!isObj(v) || seen.has(v)) return
  seen.add(v)
  if (Array.isArray(v)) { for (const x of v) walk(x, visit, seen); return }
  visit(v)
  for (const k of Object.keys(v)) walk(v[k], visit, seen)
}

export async function overlayTranslations<T>(site: SiteConfig, data: T): Promise<T> {
  if (site.viewLang !== 'en' || !process.env.NEXT_PUBLIC_SUPABASE_URL) return data
  const names = site.translate?.sections ?? {}
  const articles: Obj[] = []
  const seen = new Set<unknown>()
  walk(data, (o) => {
    if (typeof o.id === 'string' && typeof o.title === 'string' && ('published_at' in o || 'thumbnail_url' in o)) articles.push(o)
    // 기사에 붙은 섹션(category: {name, slug}) 이름
    if (typeof o.slug === 'string' && typeof o.name === 'string' && names[o.slug]) o.name = names[o.slug]
  }, seen)
  if (!articles.length) return data

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const ids = Array.from(new Set(articles.map((a) => a.id as string)))
  const wantBody = articles.some((a) => typeof a.body === 'string' && a.body)
  const found = new Map<string, { title: string; excerpt: string | null; body: string | null }>()
  for (let i = 0; i < ids.length; i += 60) {
    const { data: rows } = await supabase
      .from('article_translations')
      .select(wantBody ? 'article_id, title, excerpt, body' : 'article_id, title, excerpt')
      .eq('lang', 'en')
      .in('article_id', ids.slice(i, i + 60))
    for (const r of (rows ?? []) as unknown as { article_id: string; title: string | null; excerpt: string | null; body?: string | null }[]) {
      if (r.title) found.set(r.article_id, { title: r.title, excerpt: r.excerpt, body: r.body ?? null })
    }
  }
  for (const a of articles) {
    const t = found.get(a.id as string)
    if (!t) continue
    a.title = t.title
    if ('excerpt' in a) a.excerpt = t.excerpt || null
    if (wantBody && typeof a.body === 'string' && a.body && t.body) a.body = t.body
  }
  return data
}
