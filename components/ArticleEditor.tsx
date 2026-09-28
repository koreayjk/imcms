'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Article, Category } from '@/lib/types'

type Props = {
  article?: Article
  categories: Category[]
  userId: string
  outletId: string | null
  isEditorPlus?: boolean
}

export default function ArticleEditor({ article, categories, userId, outletId, isEditorPlus }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(article?.title ?? '')
  const [body, setBody] = useState(article?.body ?? '')
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? '')
  const [categoryId, setCategoryId] = useState(article?.category_id ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnail_url ?? '')
  const [tags, setTags] = useState(article?.tags?.join(', ') ?? '')
  const [metaTitle, setMetaTitle] = useState(article?.meta_title ?? '')
  const [metaDesc, setMetaDesc] = useState(article?.meta_description ?? '')
  const [isFeatured, setIsFeatured] = useState(article?.is_featured ?? false)
  const [scheduledAt, setScheduledAt] = useState(
    article?.scheduled_at ? article.scheduled_at.slice(0, 16) : ''
  )
  const [showSeo, setShowSeo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Ctrl+S 단축키
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      save('draft')
    }
  }, [title, body, excerpt, categoryId, thumbnailUrl, tags, metaTitle, metaDesc, isFeatured, scheduledAt])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  async function save(mode: 'draft' | 'review' | 'publish') {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!body.trim())  { setError('본문을 입력해주세요.'); return }
    setError('')
    setSaving(true)

    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean)

    const payload: Record<string, unknown> = {
      title: title.trim(),
      body: body.trim(),
      excerpt: excerpt.trim() || null,
      category_id: categoryId || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      tags: tagArray.length ? tagArray : null,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDesc.trim() || null,
      is_featured: isFeatured,
      scheduled_at: scheduledAt || null,
      outlet_id: outletId,
    }

    if (mode === 'review') {
      payload.status = 'in_review'
    } else if (mode === 'publish') {
      payload.status = 'published'
      payload.published_at = new Date().toISOString()
      payload.reviewed_by = userId
      payload.reject_reason = null
    } else if (!article) {
      payload.status = 'draft'
    }

    let id = article?.id
    if (article) {
      const { error: err } = await supabase.from('articles').update(payload).eq('id', article.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      payload.author_id = userId
      const { data, error: err } = await supabase.from('articles').insert(payload).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      id = data.id
    }

    setSaving(false)
    if (mode === 'draft') {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      if (!article) router.push(`/articles/${id}/edit`)
    } else {
      router.push(`/articles/${id}`)
    }
    router.refresh()
  }

  const isDraft = !article || article.status === 'draft' || article.status === 'rejected'
  const wordCount = body.replace(/\s/g, '').length

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* 제목 */}
      <div>
        <label className="field-label">제목 *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="기사 제목을 입력하세요"
          className="w-full rounded border border-line px-3 py-2.5 text-base font-medium focus:outline-none focus:border-ink transition-colors"
        />
      </div>

      {/* 카테고리 + 요약 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">카테고리</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="field-input"
          >
            <option value="">카테고리 선택...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">리드문 (요약)</label>
          <input
            type="text"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="기사 첫 문장 요약 (선택)"
            className="field-input"
          />
        </div>
      </div>

      {/* 대표 이미지 */}
      <div>
        <label className="field-label">대표 이미지 URL</label>
        <input
          type="url"
          value={thumbnailUrl}
          onChange={(e) => setThumbnailUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className="field-input"
        />
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt="대표 이미지 미리보기"
            className="mt-2 h-32 w-full object-cover rounded border border-line"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        )}
      </div>

      {/* 태그 */}
      <div>
        <label className="field-label">태그 (쉼표로 구분)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="예: 사회, 경제, 청년"
          className="field-input"
        />
      </div>

      {/* 본문 */}
      <div>
        <label className="field-label">본문 * <span className="font-normal text-muted">(Ctrl+S 자동저장)</span></label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="기사 본문을 입력하세요..."
          rows={28}
          className="w-full rounded border border-line px-3 py-2.5 text-sm leading-7 focus:outline-none focus:border-ink font-sans resize-none transition-colors"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{wordCount.toLocaleString()}자 (공백 제외)</span>
          <span>줄 {body.split('\n').length}줄</span>
        </div>
      </div>

      {/* SEO 설정 (접힘) */}
      <div className="rounded border border-line">
        <button
          type="button"
          onClick={() => setShowSeo(!showSeo)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted hover:text-ink transition-colors"
        >
          <span>SEO 설정</span>
          <span>{showSeo ? '▲' : '▼'}</span>
        </button>
        {showSeo && (
          <div className="px-4 pb-4 space-y-3 border-t border-line pt-3">
            <div>
              <label className="field-label">SEO 제목 (기본: 기사 제목)</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder={title || 'SEO 제목'}
                className="field-input"
                maxLength={60}
              />
              <div className="mt-1 text-xs text-muted text-right">{metaTitle.length}/60</div>
            </div>
            <div>
              <label className="field-label">SEO 설명</label>
              <textarea
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                placeholder="검색 결과에 표시될 설명 (160자 이내)"
                rows={2}
                className="field-input resize-none"
                maxLength={160}
              />
              <div className="mt-1 text-xs text-muted text-right">{metaDesc.length}/160</div>
            </div>
          </div>
        )}
      </div>

      {/* 발행 옵션 */}
      <div className="flex flex-wrap items-center gap-4 px-1">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="rounded"
          />
          주요 기사(★)로 설정
        </label>

        <div className="flex items-center gap-2">
          <label className="text-sm text-muted">예약 발행:</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded border border-line px-2 py-1 text-xs focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between pt-3 border-t border-line">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted hover:text-ink"
        >
          취소
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => save('draft')}
            disabled={saving}
            className="btn-secondary"
          >
            {saved ? '저장됨 ✓' : saving ? '저장 중...' : '초안 저장'}
          </button>

          {isDraft && (
            <button
              onClick={() => save('review')}
              disabled={saving}
              className="btn-review"
            >
              검토 요청
            </button>
          )}

          {isEditorPlus && article?.status !== 'published' && (
            <button
              onClick={() => save('publish')}
              disabled={saving}
              className="btn-publish"
            >
              바로 발행
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
