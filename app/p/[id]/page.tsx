import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { shareTokenOk } from '@/lib/article-share'
import { getArticleSidebar, siteForOutlet, type PublicArticle } from '@/lib/public-data'
import { sanitizeBody } from '@/lib/article-html'
import SiteFrame from '@/components/site/SiteFrame'
import ArticleMain from '@/components/site/ArticleMain'
import ArticleAside from '@/components/site/ArticleAside'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '기사 미리보기', robots: { index: false, follow: false } }

type Row = Record<string, any> & { id: string; outlet_id: string; status: string; published_at: string | null }

// 미리보기 링크: 아직 발행 전인 기사를 링크를 받은 사람만 볼 수 있다 (서명이 맞을 때만, 검색엔진 노출 없음)
export default async function SharedPreviewPage({ params, searchParams }: { params: { id: string }; searchParams: { k?: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id) || !shareTokenOk(params.id, searchParams.k) || !process.env.NEXT_PUBLIC_SUPABASE_URL) notFound()
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data, error } = await supabase.rpc('article_share_view', { secret: process.env.PAYMENT_DB_SECRET, p_id: params.id })
  const v = data as Row | null
  if (error || !v) notFound()

  // 이미 홈페이지에 공개됐으면 실제 기사로
  if (v.status === 'published' && (!v.published_at || Date.parse(v.published_at) <= Date.now())) redirect(`/news/${v.id}`)

  const site = await siteForOutlet(v.outlet_id)
  const { mostViewed, latest } = await getArticleSidebar(site)
  const a: PublicArticle = {
    id: v.id,
    title: v.title,
    excerpt: v.excerpt ?? null,
    thumbnail_url: v.thumbnail_url ?? null,
    published_at: v.published_at ?? new Date().toISOString(),
    view_count: 0,
    is_featured: false,
    author_name: (typeof v.byline === 'string' && v.byline.trim()) || v.author_full_name || null,
    author_email: v.byline_email ?? null,
    category: v.category ?? null,
    tags: v.tags ?? null,
  }
  const section = a.category ? site.sections.find((s) => s.slug === a.category!.slug) : undefined
  const state = v.status === 'published' ? '예약 발행 전' : v.status === 'in_review' ? '승인 대기' : v.status === 'rejected' ? '반려됨' : '작성 중'

  return (
    <SiteFrame site={site} current={a.category?.slug}>
      <div className="bg-[#1C1F26] px-4 py-2 text-center text-[12.5px] text-white">
        <strong>미리보기</strong> · 아직 홈페이지에 공개되지 않은 기사입니다({state}). 링크를 받은 사람만 볼 수 있습니다.
      </div>
      <div className="mx-auto grid max-w-[1200px] gap-12 px-4 py-7 lg:grid-cols-[1fr_300px] lg:py-10">
        <ArticleMain a={a} bodyHtml={sanitizeBody(v.body)} sectionName={section?.name} siteName={site.name} />
        <ArticleAside site={site} mostViewed={mostViewed} latest={latest} />
      </div>
    </SiteFrame>
  )
}
