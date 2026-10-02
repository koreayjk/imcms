'use client'

import { useEffect, useState, type ReactNode } from 'react'
import ArticleMain from '@/components/site/ArticleMain'
import { PREVIEW_STORE, type ArticlePreviewData } from '@/lib/article-preview'
import { previewBody } from './actions'

// 기사쓰기 화면이 넘긴 내용을 실제 기사 화면 모양으로 그린다 (아직 저장 전 내용도 볼 수 있다)
export default function PreviewArticle({ siteName, sectionNames, bottomAd }: { siteName: string; sectionNames: Record<string, string>; bottomAd: ReactNode }) {
  const [d, setD] = useState<ArticlePreviewData | null | undefined>(undefined)
  const [body, setBody] = useState<string | null>(null)

  useEffect(() => {
    let data: ArticlePreviewData | null = null
    try { data = JSON.parse(sessionStorage.getItem(PREVIEW_STORE) ?? 'null') } catch { data = null }
    setD(data)
    if (data) previewBody(data.html).then(setBody).catch(() => setBody(''))
  }, [])

  // 미리보기 안에서는 링크·검색으로 다른 화면에 가지 않는다
  useEffect(() => {
    const click = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a')) e.preventDefault() }
    const submit = (e: Event) => e.preventDefault()
    document.addEventListener('click', click, true)
    document.addEventListener('submit', submit, true)
    return () => { document.removeEventListener('click', click, true); document.removeEventListener('submit', submit, true) }
  }, [])

  if (d === undefined || (d && body === null)) return <div className="min-h-[60vh]" aria-busy="true" />
  if (!d) return <p className="py-20 text-center text-sub">미리볼 기사 내용이 없습니다. 기사쓰기 화면에서 미리보기를 다시 눌러 주세요.</p>

  return (
    <ArticleMain
      a={{
        id: 'preview',
        title: d.title || '(제목 없음)',
        excerpt: d.subtitle || null,
        thumbnail_url: d.thumbnail,
        published_at: d.publishedAt,
        view_count: 0,
        is_featured: false,
        author_name: d.author || null,
        author_email: d.email,
        category: d.category,
        tags: d.tags.length ? d.tags : null,
      }}
      bodyHtml={body ?? ''}
      sectionName={d.category ? sectionNames[d.category.slug] ?? d.category.name : undefined}
      siteName={siteName}
      bottomAd={bottomAd}
    />
  )
}
