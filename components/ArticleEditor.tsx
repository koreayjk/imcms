'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Editor } from '@tiptap/react'
import { createClient } from '@/lib/supabase'
import { toHtml } from '@/lib/body-text'
import { STATUS_LABEL, type Article, type ArticleStatus, type Category } from '@/lib/types'
import RichEditor from './editor/RichEditor'
import MediaPanel, { type LibraryImage } from './editor/MediaPanel'
import { uploadImage } from './editor/upload'
import { describe, syndicate } from '@/lib/syndicate'
import PendingButton from './cms/PendingButton'
import { deleteArticle } from '@/app/(main)/articles/actions'

type Props = {
  article?: Article
  categories: Category[]
  userId: string
  outletId: string | null
  outletName: string | null
  authorName: string
  authorEmail: string | null
  isEditorPlus?: boolean
  outlets: { id: string; name: string }[]
  syndicatedOutletIds: string[]
  sourceOutletName: string | null
  // 수정할 때 원 작성자의 회원 이름 (편집장이 다른 기자 글을 고칠 때)
  articleAuthorName?: string | null
}

type Mode = 'draft' | 'review' | 'publish'

const IMG_SRC = /<img[^>]+src="([^"]+)"[^>]*>/gi

function saveError(message: string) {
  if (/byline/.test(message)) return '기자명을 바꾸려면 관리자가 Supabase에서 article-manage.sql을 실행해야 합니다. 기자명을 원래대로 두면 저장됩니다.'
  return `저장하지 못했습니다: ${message}`
}

function imagesIn(html: string): string[] {
  return Array.from(html.matchAll(IMG_SRC), (m) => m[1])
}

export default function ArticleEditor({ article, categories, userId, outletId, outletName, authorName, authorEmail, isEditorPlus, outlets, syndicatedOutletIds, sourceOutletName, articleAuthorName }: Props) {
  const router = useRouter()
  const editorRef = useRef<Editor | null>(null)

  const [initialHtml] = useState(() =>
    article ? toHtml(article.body) : `<p>[${outletName ? `${outletName}=` : ''}${authorName} 기자]&nbsp;</p>`
  )
  const [title, setTitle] = useState(article?.title ?? '')
  const [subtitle, setSubtitle] = useState(article?.excerpt ?? '')
  const [html, setHtml] = useState(initialHtml)
  const [charCount, setCharCount] = useState(0)
  const [categoryId, setCategoryId] = useState(article?.category_id ?? '')
  const [thumbnailUrl, setThumbnailUrl] = useState(article?.thumbnail_url ?? '')
  const [images, setImages] = useState<LibraryImage[]>(() => {
    const urls = new Set([...(article?.thumbnail_url ? [article.thumbnail_url] : []), ...imagesIn(initialHtml)])
    return Array.from(urls, (url) => ({ url, caption: '' }))
  })
  const [tags, setTags] = useState(article?.tags?.join(', ') ?? '')
  const [metaTitle, setMetaTitle] = useState(article?.meta_title ?? '')
  const [metaDesc, setMetaDesc] = useState(article?.meta_description ?? '')
  const [isFeatured, setIsFeatured] = useState(article?.is_featured ?? false)
  const [syndicateTo, setSyndicateTo] = useState<string[]>(article?.syndicate_to ?? [])
  const [showSeo, setShowSeo] = useState(false)
  const [saving, setSaving] = useState<Mode | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const defaultName = (article ? articleAuthorName : authorName) ?? ''
  const [byline, setByline] = useState(article?.byline?.trim() || defaultName)
  const shownName = useRef(byline)

  const status: ArticleStatus = article?.status ?? 'draft'
  const isMine = !article || article.author_id === userId
  const isCopy = !!article?.source_article_id
  const ownOutlet = article?.outlet_id ?? outletId
  const otherOutlets = outlets.filter((o) => o.id !== ownOutlet)

  async function save(mode: Mode) {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!charCount) { setError('본문을 입력해주세요.'); return }
    if (mode === 'publish' && !window.confirm('이 기사를 지금 홈페이지에 발행할까요?')) return
    setError('')
    setSaving(mode)

    const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean)
    const payload: Record<string, unknown> = {
      title: title.trim(),
      body: html,
      excerpt: subtitle.trim() || null,
      category_id: categoryId || null,
      thumbnail_url: thumbnailUrl || imagesIn(html)[0] || null,
      tags: tagArray.length ? tagArray : null,
      meta_title: metaTitle.trim() || null,
      meta_description: metaDesc.trim() || null,
      is_featured: isFeatured,
      outlet_id: ownOutlet,
    }
    // syndication.sql 실행 전 DB에는 이 칸이 없으므로, 기존 값이 있거나 매체를 고른 경우에만 보낸다
    if (!isCopy && (article?.syndicate_to !== undefined || syndicateTo.length)) payload.syndicate_to = syndicateTo
    // 기자명이 회원 이름과 같으면 비워 둔다 (회원 이름을 바꾸면 기사에도 따라 바뀌도록)
    const customByline = byline.trim() && byline.trim() !== defaultName ? byline.trim() : null
    if (customByline || article?.byline !== undefined) payload.byline = customByline

    if (mode === 'review') {
      payload.status = 'in_review'
    } else if (mode === 'publish') {
      payload.status = 'published'
      payload.published_at = article?.published_at ?? new Date().toISOString()
      payload.reviewed_by = userId
      payload.reject_reason = null
    } else if (!article) {
      payload.status = 'draft'
    }

    const supabase = createClient()
    let id = article?.id
    if (article) {
      const { error: err } = await supabase.from('articles').update(payload).eq('id', article.id)
      if (err) { setError(saveError(err.message)); setSaving(null); return }
    } else {
      payload.author_id = userId
      const { data, error: err } = await supabase.from('articles').insert(payload).select('id').single()
      if (err) { setError(saveError(err.message)); setSaving(null); return }
      id = data.id
    }

    const livePublished = mode === 'publish' || (mode === 'draft' && status === 'published')
    if (id && livePublished && !isCopy && syndicateTo.length) {
      try {
        const summary = describe(await syndicate(id))
        if (summary) window.alert(summary)
      } catch (e) {
        window.alert(`함께 송고 중 문제가 생겼습니다: ${e instanceof Error ? e.message : ''}`)
      }
    }

    setSaving(null)
    if (mode === 'draft') {
      setSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
      if (!article) router.replace(`/articles/${id}/edit`)
      router.refresh()
    } else {
      router.push(`/articles/${id}`)
      router.refresh()
    }
  }

  // 기자명을 바꾸면 본문 첫머리 "[매체=이름 기자]"도 같이 바꾼다
  function syncBylineInBody(value = byline) {
    const next = value.trim() || defaultName
    const prev = shownName.current
    if (!next || next === prev) return
    shownName.current = next
    const editor = editorRef.current
    const from = `${prev} 기자]`
    if (!editor || !html.includes(from)) return
    const updated = html.replace(from, `${next} 기자]`)
    editor.commands.setContent(updated, true)
    setHtml(updated)
  }

  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current('draft')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const onReady = useCallback((editor: Editor) => { editorRef.current = editor }, [])
  const onChange = useCallback((next: string, count: number) => { setHtml(next); setCharCount(count) }, [])

  function insertImage(img: LibraryImage) {
    const editor = editorRef.current
    if (!editor) return
    const caption = img.caption.trim()
    editor.chain().focus().insertContent([
      { type: 'image', attrs: { src: img.url, alt: caption } },
      ...(caption ? [{ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text: `▲ ${caption}` }] }] : []),
    ]).run()
  }

  function insertYoutube(url: string) {
    return editorRef.current?.chain().focus().setYoutubeVideo({ src: url }).run() ?? false
  }

  return (
    <div className="pb-24">
      <div className="grid grid-cols-[1fr_300px] items-start gap-6">
        <div className="space-y-5 rounded-lg border border-line bg-white p-7">
          <div className="flex flex-wrap items-center gap-3 border-b border-line pb-5">
            <span className="w-16 text-[13px] font-semibold">기사상태</span>
            <span className={`status-badge status-${status} px-2.5 py-1 text-[12.5px]`}>{STATUS_LABEL[status]}</span>
            {savedAt && <span className="text-[12px] text-muted">{savedAt} 저장됨</span>}
            {status === 'rejected' && article?.reject_reason && (
              <p className="w-full rounded border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                <strong>반려 사유:</strong> {article.reject_reason}
              </p>
            )}
          </div>

          {article?.ai_notes && (
            <div className="rounded border border-draft/40 bg-draft/10 px-4 py-3 text-[13px] leading-relaxed">
              <p className="font-semibold text-draft">AI 초안 — 발행 전에 확인하세요</p>
              <p className="mt-1 whitespace-pre-line text-ink">{article.ai_notes}</p>
              <p className="mt-1.5 text-[12px] text-muted">이 메모는 편집 화면에만 보이고 홈페이지에는 나가지 않습니다. 원문과 사실관계를 대조한 뒤 발행해 주세요.</p>
            </div>
          )}

          <div className="grid grid-cols-[64px_1fr] items-center gap-x-3 gap-y-3">
            <label htmlFor="section" className="text-[13px] font-semibold">섹션</label>
            <select id="section" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-input max-w-xs">
              <option value="">섹션 선택</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <label htmlFor="byline" className="text-[13px] font-semibold">기자명</label>
            <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
              <div className="flex items-center rounded border border-line focus-within:border-ink">
                <input
                  id="byline"
                  value={byline}
                  onChange={(e) => setByline(e.target.value)}
                  onBlur={() => syncBylineInBody()}
                  maxLength={30}
                  placeholder={defaultName || '기자 이름'}
                  className="w-36 bg-transparent px-3 py-2 outline-none"
                />
                <span className="pr-3 text-muted">기자</span>
              </div>
              {isMine && authorEmail && <span className="rounded border border-line bg-[#F8F9FA] px-3 py-2 text-muted">{authorEmail}</span>}
              {byline.trim() && byline.trim() !== defaultName && (
                <button type="button" onClick={() => { setByline(defaultName); syncBylineInBody(defaultName) }} className="text-[12px] text-muted underline underline-offset-2 hover:text-ink">
                  {defaultName}(으)로 되돌리기
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <div>
              <label htmlFor="title" className="sr-only">제목</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력하세요"
                className="w-full rounded border border-line px-4 py-3 text-[19px] font-bold outline-none focus:border-ink/60"
              />
              <div className="mt-1 text-right text-[11.5px] tabular-nums text-muted">{title.length}자</div>
            </div>
            <div>
              <label htmlFor="subtitle" className="sr-only">부제목</label>
              <textarea
                id="subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                rows={2}
                placeholder="부제목을 입력하세요 (여러 줄 가능 · 기사 목록의 요약과 검색 결과 설명으로도 쓰입니다)"
                className="w-full resize-y rounded border border-line px-4 py-2.5 text-[14.5px] leading-relaxed outline-none focus:border-ink/60"
              />
            </div>
          </div>

          <div>
            <RichEditor
              initialHtml={initialHtml}
              onChange={onChange}
              onReady={onReady}
              advanced={isEditorPlus}
              onUploadImage={async (file) => {
                const url = await uploadImage(file, outletId)
                setImages((prev) => [...prev, { url, caption: '' }])
                if (!thumbnailUrl) setThumbnailUrl(url)
                return url
              }}
            />
            <div className="mt-1.5 flex justify-between text-[12px] text-muted">
              <span>사진을 누르면 크기(25~100%)·배치를 바꿀 수 있고, 파란 모서리를 끌어도 됩니다 · Ctrl+S 저장</span>
              <span className="tabular-nums">{charCount.toLocaleString()}자 (공백 제외)</span>
            </div>
          </div>

          <div className="grid grid-cols-[64px_1fr] items-center gap-3 border-t border-line pt-5">
            <label htmlFor="tags" className="text-[13px] font-semibold">태그</label>
            <input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="쉼표로 구분 (예: 요양병원, 간병비)" className="field-input" />

            <span className="text-[13px] font-semibold">옵션</span>
            <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
              <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
              주요 기사로 지정 (홈페이지 톱 영역 우선 노출)
            </label>
          </div>

          {isCopy ? (
            <p className="rounded border border-review/30 bg-review/5 px-4 py-3 text-[13px] leading-relaxed text-review">
              이 기사는 <strong>{sourceOutletName ?? '다른 매체'}</strong>에서 함께 송고된 사본입니다. 원본이 다시 반영되면 제목·본문이 원본 내용으로 바뀝니다.
            </p>
          ) : otherOutlets.length > 0 && (
            <fieldset className="rounded border border-line px-4 py-3.5">
              <legend className="px-1 text-[13px] font-semibold">함께 송고할 매체</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {otherOutlets.map((o) => {
                  const sent = syndicatedOutletIds.includes(o.id)
                  return (
                    <label key={o.id} className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                      <input
                        type="checkbox"
                        checked={sent || syndicateTo.includes(o.id)}
                        disabled={sent}
                        onChange={(e) => setSyndicateTo((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                      />
                      {o.name}
                      {sent && <span className="rounded bg-published/10 px-1.5 text-[11px] text-published">송고됨</span>}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                발행될 때 선택한 매체에 바이라인과 섹션을 맞춰 사본이 올라갑니다. 사본에는 이 기사를 원본으로 알리는 표시가 들어가 검색엔진에서 중복 기사로 처리되지 않습니다.
              </p>
            </fieldset>
          )}

          <div className="rounded border border-line">
            <button type="button" onClick={() => setShowSeo(!showSeo)} aria-expanded={showSeo} className="flex w-full items-center justify-between px-4 py-3 text-[13px] text-muted hover:text-ink">
              <span>검색·공유 설정 (SEO) — 비워두면 제목과 부제목이 쓰입니다</span>
              <span aria-hidden>{showSeo ? '▲' : '▼'}</span>
            </button>
            {showSeo && (
              <div className="space-y-3 border-t border-line px-4 pb-4 pt-3">
                <div>
                  <label htmlFor="meta-title" className="field-label">검색 결과 제목</label>
                  <input id="meta-title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title || '기사 제목'} maxLength={60} className="field-input" />
                  <div className="mt-1 text-right text-[11.5px] text-muted">{metaTitle.length}/60</div>
                </div>
                <div>
                  <label htmlFor="meta-desc" className="field-label">검색 결과 설명</label>
                  <textarea id="meta-desc" value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder={subtitle || '160자 이내'} rows={2} maxLength={160} className="field-input resize-none" />
                  <div className="mt-1 text-right text-[11.5px] text-muted">{metaDesc.length}/160</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="sticky top-6 rounded-lg border border-line bg-white p-5">
          <h2 className="mb-4 text-[16px] font-bold">라이브러리</h2>
          <MediaPanel
            outletId={outletId}
            images={images}
            setImages={setImages}
            thumbnailUrl={thumbnailUrl}
            onInsertImage={insertImage}
            onSetThumbnail={setThumbnailUrl}
            onInsertYoutube={insertYoutube}
          />
        </aside>
      </div>

      <div className="fixed bottom-0 right-0 z-20 border-t border-line bg-white/95 backdrop-blur" style={{ left: 76 }}>
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-8 py-3">
          {error ? (
            <p role="alert" className="flex-1 truncate text-[13px] text-danger">{error}</p>
          ) : (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => router.back()} className="text-[13px] text-muted hover:text-ink">← 취소</button>
              {article && (
                <form action={deleteArticle.bind(null, article.id)}>
                  <PendingButton
                    pending="삭제 중…"
                    confirm={`이 기사를 삭제할까요?${status === 'published' ? '\n홈페이지에서도 바로 내려가고, 함께 송고된 다른 매체 사본도 삭제됩니다.' : ''}\n삭제하면 되돌릴 수 없습니다.`}
                    className="text-[13px] text-muted hover:text-danger"
                  >
                    기사 삭제
                  </PendingButton>
                </form>
              )}
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => save('draft')} disabled={!!saving} className="btn-secondary px-5">
              {saving === 'draft' ? '저장 중…' : '저장'}
            </button>
            {status !== 'published' && status !== 'in_review' && (
              <button type="button" onClick={() => save('review')} disabled={!!saving} className="btn-review px-5">
                {saving === 'review' ? '신청 중…' : '승인신청'}
              </button>
            )}
            {isEditorPlus && (
              <button type="button" onClick={() => save('publish')} disabled={!!saving} className="btn-publish px-5">
                {saving === 'publish' ? '발행 중…' : status === 'published' ? '수정 내용 반영' : '바로 발행'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
