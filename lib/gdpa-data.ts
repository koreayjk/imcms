import { createClient } from '@supabase/supabase-js'
import type { GdpaBoard } from './gdpa'

// 협회 사이트 공개 자료 (로그인 없이 읽는다). DB 연결 전(미리보기)에는 샘플을 보여준다
const isDemo = !process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

export type MemberOutlet = { id: string; name: string; domain: string | null; logo: string | null; intro: string; joinedOn: string; url: string | null }
export type MemberNews = { id: string; title: string; excerpt: string | null; thumb: string | null; publishedAt: string | null; outlet: string; url: string }
export type GdpaPost = { id: string; board: GdpaBoard; title: string; body: string; pinned: boolean; created_at: string }

const DEMO_OUTLETS: MemberOutlet[] = [
  { id: 'demo-1', name: '더케어타임즈', domain: 'thecaretimes.net', logo: '/sites/thecaretimes/logo-mark.png', intro: '보건·복지, 병원·의료, 요양·시니어케어, 돌봄산업 전문 인터넷신문', joinedOn: '2026-10-03', url: 'https://thecaretimes.net' },
  { id: 'demo-2', name: 'Shipping Times', domain: 'shippingtimes.vercel.app', logo: '/sites/shippingtimes/logo-full.svg', intro: '해운·항만·항공화물·포워딩·무역 전문 국제물류 미디어', joinedOn: '2026-10-03', url: 'https://shippingtimes.vercel.app' },
  { id: 'demo-3', name: 'Israel Today', domain: 'israeltoday-kr.vercel.app', logo: '/sites/israeltoday/logo-full.svg', intro: '이스라엘 현지 소식과 성경·쉐마 교육을 전하는 기독교 전문 미디어', joinedOn: '2026-10-03', url: 'https://israeltoday-kr.vercel.app' },
]

const siteUrl = (domain: string | null) => (domain ? `https://${domain}` : null)

export async function memberOutlets(): Promise<MemberOutlet[]> {
  if (isDemo) return DEMO_OUTLETS
  const { data } = await anon()
    .from('gdpa_member_outlets')
    .select('outlet_id, sort_order, joined_on, intro, outlet:outlets(id, name, domain, site)')
    .order('sort_order')
  return ((data ?? []) as any[]).filter((r) => r.outlet).map((r) => {
    const site = (r.outlet.site ?? {}) as { logoUrl?: string; description?: string }
    return {
      id: r.outlet.id,
      name: r.outlet.name,
      domain: r.outlet.domain,
      logo: site.logoUrl ?? null,
      intro: r.intro || site.description || '',
      joinedOn: r.joined_on,
      url: siteUrl(r.outlet.domain),
    }
  })
}

// 회원사 최신 기사 (발행된 기사만, 각 매체 홈페이지로 연결)
export async function memberNews(limit = 12, page = 1): Promise<{ items: MemberNews[]; total: number }> {
  const outlets = await memberOutlets()
  if (isDemo) {
    const items = outlets.flatMap((o, i) => [0, 1, 2, 3].map((n) => ({
      id: `${o.id}-${n}`, title: `${o.name} 샘플 기사 ${n + 1}`, excerpt: '회원사 홈페이지에 실린 최신 기사가 이곳에 모입니다.',
      thumb: null, publishedAt: new Date(Date.now() - (i * 4 + n) * 3600e3).toISOString(), outlet: o.name, url: o.url ?? '#',
    })))
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length }
  }
  if (!outlets.length) return { items: [], total: 0 }
  const byId = new Map(outlets.map((o) => [o.id, o]))
  const from = (page - 1) * limit
  const { data, count } = await anon()
    .from('articles')
    .select('id, title, excerpt, thumbnail_url, published_at, outlet_id', { count: 'exact' })
    .in('outlet_id', outlets.map((o) => o.id))
    .eq('status', 'published')
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
    .range(from, from + limit - 1)
  const items = ((data ?? []) as any[]).map((a) => {
    const o = byId.get(a.outlet_id)!
    // 매체 홈페이지 주소가 있으면 그 주소로, 사진이 상대 주소면 그 홈페이지 기준으로
    const base = o.url ?? ''
    const thumb: string | null = a.thumbnail_url ? (a.thumbnail_url.startsWith('/') ? `${base}${a.thumbnail_url}` : a.thumbnail_url) : null
    return { id: a.id, title: a.title, excerpt: a.excerpt, thumb, publishedAt: a.published_at, outlet: o.name, url: `${base}/news/${a.id}` }
  })
  return { items, total: count ?? items.length }
}

const DEMO_POSTS: GdpaPost[] = [
  { id: '00000000-0000-0000-0000-000000000001', board: 'notice', title: '글로벌디지털언론협회(GDPA) 홈페이지를 열었습니다', body: '글로벌디지털언론협회(GDPA) 홈페이지를 열었습니다.\n\n협회는 디지털 시대에 맞는 책임 있는 저널리즘과 회원사 간 협력을 위해 출범을 준비하고 있습니다.', pinned: true, created_at: '2026-10-03T00:00:00Z' },
]

export async function boardPosts(board: GdpaBoard, page = 1, size = 15): Promise<{ items: GdpaPost[]; total: number }> {
  if (isDemo) {
    const items = DEMO_POSTS.filter((p) => p.board === board)
    return { items, total: items.length }
  }
  const from = (page - 1) * size
  const { data, count } = await anon()
    .from('gdpa_posts')
    .select('id, board, title, body, pinned, created_at', { count: 'exact' })
    .eq('board', board)
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + size - 1)
  return { items: (data ?? []) as GdpaPost[], total: count ?? 0 }
}

export async function boardPost(id: string): Promise<GdpaPost | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null
  if (isDemo) return DEMO_POSTS.find((p) => p.id === id) ?? null
  const { data } = await anon().from('gdpa_posts').select('id, board, title, body, pinned, created_at').eq('id', id).eq('published', true).maybeSingle()
  return (data as GdpaPost | null) ?? null
}
