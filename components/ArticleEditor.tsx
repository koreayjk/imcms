'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Editor } from '@tiptap/react'
import { createClient } from '@/lib/supabase'
import { toHtml } from '@/lib/body-text'
import { formatDateTime, fromKstInput, isScheduled, toKstInput } from '@/lib/format'
import { STATUS_LABEL, type Article, type ArticleStatus, type Category } from '@/lib/types'
import RichEditor from './editor/RichEditor'
import MediaPanel, { type LibraryImage } from './editor/MediaPanel'
import { uploadImage } from './editor/upload'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'
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
  // 발행 일시: 비우면 발행하는 순간, 지정하면 그 시각 (지난 시각 = 그 날짜로, 앞으로의 시각 = 예약 발행)
  const [pubAt, setPubAt] = useState(toKstInput(article?.published_at))
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

  // 자동 저장으로 처음 만든 기사 ID (새 기사일 때)
  const [draftId, setDraftId] = useState<string | null>(article?.id ?? null)
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null)

  // 저장할 내용 (상태 변경은 저장 방식에 따라 따로 붙인다)
  function contentPayload(): Record<string, unknown> {
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
    return payload
  }

  async function save(mode: Mode) {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!charCount) { setError('본문을 입력해주세요.'); return }
    const chosenAt = fromKstInput(pubAt)
    if (pubAt && !chosenAt) { setError('발행 일시를 확인해 주세요.'); return }
    if (mode === 'publish') {
      const when = chosenAt ? new Date(chosenAt) : null
      const msg = when && when.getTime() > Date.now() + 60_000
        ? `${formatDateTime(chosenAt)}에 홈페이지에 공개되도록 예약 발행할까요?\n그 전까지는 홈페이지에 보이지 않습니다.`
        : when && when.getTime() < Date.now() - 60_000
          ? `발행 일시를 ${formatDateTime(chosenAt)}(지난 날짜)로 해서 발행할까요?`
          : '이 기사를 지금 홈페이지에 발행할까요?'
      if (!window.confirm(msg)) return
    }
    setError('')
    setSaving(mode)

    const payload = contentPayload()
    // 발행 전 기사는 정한 일시를 같이 저장해 두고(편집장이 승인할 때 그대로 쓴다), 발행된 기사는 일시만 고친다
    if (mode !== 'publish') payload.published_at = chosenAt ?? (status === 'published' ? article?.published_at ?? null : null)

    if (mode === 'review') {
      payload.status = 'in_review'
    } else if (mode === 'publish') {
      payload.status = 'published'
      payload.published_at = chosenAt ?? new Date().toISOString()
      payload.reviewed_by = userId
      payload.reject_reason = null
    } else if (!article) {
      payload.status = 'draft'
    }

    const supabase = createClient()
    let id = article?.id ?? draftId
    if (id) {
      const { error: err } = await supabase.from('articles').update(payload).eq('id', id)
      if (err) { setError(saveError(err.message)); setSaving(null); return }
    } else {
      payload.author_id = userId
      const { data, error: err } = await supabase.from('articles').insert(payload).select('id').single()
      if (err) { setError(saveError(err.message)); setSaving(null); return }
      id = data.id
    }
    // 저장했으니 이 브라우저의 임시 백업은 지운다
    clearLocalBackup()
    serverKey.current = contentKey

    // 승인신청이면 편집장들에게 알림 메일 (메일 설정 전이면 아무 일도 하지 않는다)
    if (id && mode === 'review') notifyArticle(id, 'submitted').catch(() => {})

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

  // ───────── 자동 저장 ─────────
  // ① 이 브라우저에 바로바로 백업 (창이 닫히거나 인터넷이 끊겨도 다시 열면 복구)
  // ② 아직 발행 전(작성중·반려)인 기사는 1분마다 서버에도 조용히 저장 → 기사목록 “작성중”이 임시보관함
  //    발행된 기사·승인신청 중인 기사는 홈페이지·편집장 화면이 바뀌지 않도록 브라우저 백업만 한다
  const backupKey = article ? `im-autosave-${article.id}` : `im-autosave-new-${userId}-${outletId ?? 'none'}`
  const contentKey = JSON.stringify([title, subtitle, html, categoryId, tags, byline, pubAt, metaTitle, metaDesc, isFeatured, thumbnailUrl])
  const serverKey = useRef(contentKey)
  const [restore, setRestore] = useState<{ at: number; data: Record<string, unknown> } | null>(null)
  const canServerAutosave = !isCopy && (status === 'draft' || status === 'rejected')

  function clearLocalBackup() {
    try { localStorage.removeItem(backupKey) } catch {}
  }

  // 편집기가 준비되면(본문 정리가 끝난 뒤) 지금 내용을 기준으로 삼고, 저장하지 않은 백업이 있으면 복구할지 묻는다
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready) return
    serverKey.current = contentKey
    try {
      const raw = localStorage.getItem(backupKey)
      if (!raw) return
      const b = JSON.parse(raw) as { at: number; key: string; data: Record<string, unknown> }
      const stale = article && Date.parse(article.updated_at) > b.at
      if (stale || b.key === serverKey.current) { localStorage.removeItem(backupKey); return }
      setRestore({ at: b.at, data: b.data })
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // ① 고칠 때마다 1.2초 뒤 브라우저에 백업
  useEffect(() => {
    if (!ready || contentKey === serverKey.current || restore) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(backupKey, JSON.stringify({
          at: Date.now(), key: contentKey,
          data: { title, subtitle, html, categoryId, tags, byline, pubAt, metaTitle, metaDesc, isFeatured, thumbnailUrl },
        }))
      } catch {}
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, restore, ready])

  // ② 1분마다 서버에 조용히 저장 (발행 전 기사만, 제목·본문이 있을 때)
  const autoRef = useRef<() => Promise<void>>()
  autoRef.current = async () => {
    if (!ready || !canServerAutosave || saving || restore || contentKey === serverKey.current) return
    if (!title.trim() || !charCount) return
    const key = contentKey
    const payload = contentPayload()
    const chosenAt = fromKstInput(pubAt)
    if (chosenAt || !pubAt) payload.published_at = chosenAt
    const supabase = createClient()
    const id = article?.id ?? draftId
    if (id) {
      const { error: err } = await supabase.from('articles').update(payload).eq('id', id)
      if (err) return
    } else {
      const { data, error: err } = await supabase.from('articles').insert({ ...payload, status: 'draft', author_id: userId }).select('id').single()
      if (err || !data) return
      setDraftId(data.id)
      // 화면을 다시 그리지 않고 주소만 편집 주소로 바꾼다 (새로고침해도 이어서 쓰도록)
      window.history.replaceState(null, '', `/articles/${data.id}/edit`)
    }
    serverKey.current = key
    clearLocalBackup()
    setAutoSavedAt(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))
  }
  useEffect(() => {
    const t = setInterval(() => { autoRef.current?.() }, 60_000)
    return () => clearInterval(t)
  }, [])

  function applyRestore() {
    if (!restore) return
    const d = restore.data as Record<string, any>
    setTitle(d.title ?? ''); setSubtitle(d.subtitle ?? ''); setCategoryId(d.categoryId ?? ''); setTags(d.tags ?? '')
    setByline(d.byline ?? defaultName); setPubAt(d.pubAt ?? ''); setMetaTitle(d.metaTitle ?? ''); setMetaDesc(d.metaDesc ?? '')
    setIsFeatured(!!d.isFeatured); setThumbnailUrl(d.thumbnailUrl ?? '')
    if (typeof d.html === 'string') { editorRef.current?.commands.setContent(d.html, true); setHtml(d.html) }
    setRestore(null)
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

  const onReady = useCallback((editor: Editor) => { editorRef.current = editor; setReady(true) }, [])
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
      <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5 rounded-lg border border-line bg-white p-4 md:p-7">
          <div className="flex flex-wrap items-center gap-3 border-b border-line pb-5">
            <span className="w-16 text-[13px] font-semibold">기사상태</span>
            {article && isScheduled(article)
              ? <span className="status-badge status-scheduled px-2.5 py-1 text-[12.5px]">예약 · {formatDateTime(article.published_at)} 공개</span>
              : <span className={`status-badge status-${status} px-2.5 py-1 text-[12.5px]`}>{STATUS_LABEL[status]}</span>}
            {savedAt && <span className="text-[12px] text-muted">{savedAt} 저장됨</span>}
            {autoSavedAt && !savedAt && <span className="text-[12px] text-muted">{autoSavedAt} 자동 저장됨</span>}
            {canServerAutosave
              ? <span className="text-[11.5px] text-muted md:ml-auto">1분마다 자동 저장 · 기사목록 “작성중”에 보관</span>
              : <span className="text-[11.5px] text-muted md:ml-auto">쓰는 내용은 이 브라우저에 자동 백업</span>}
            {status === 'rejected' && article?.reject_reason && (
              <p className="w-full rounded border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                <strong>반려 사유:</strong> {article.reject_reason}
              </p>
            )}
          </div>

          {restore && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded border border-[#2F6BF0]/40 bg-[#2F6BF0]/5 px-4 py-3 text-[13px]">
              <span className="min-w-0 flex-1">
                <strong className="text-[#2F6BF0]">저장하지 않은 작성 내용이 있습니다.</strong>{' '}
                {new Date(restore.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}에 이 브라우저에 백업된 내용을 불러올까요?
              </span>
              <button type="button" onClick={applyRestore} className="btn-primary px-3 py-1.5 text-[12.5px]">불러오기</button>
              <button type="button" onClick={() => { clearLocalBackup(); setRestore(null) }} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-danger">버리기</button>
            </div>
          )}

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
              {isMine && authorEmail && <span className="max-w-full truncate rounded border border-line bg-[#F8F9FA] px-3 py-2 text-muted">{authorEmail}</span>}
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
            <div className="mt-1.5 flex justify-between gap-3 text-[12px] text-muted">
              <span><span className="md:hidden">사진을 누르면 크기·배치를 바꿀 수 있습니다</span><span className="hidden md:inline">사진을 누르면 크기(25~100%)·배치를 바꿀 수 있고, 파란 모서리를 끌어도 됩니다 · Ctrl+S 저장</span></span>
              <span className="shrink-0 tabular-nums">{charCount.toLocaleString()}자<span className="hidden md:inline"> (공백 제외)</span></span>
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

            <label htmlFor="pub-at" className="text-[13px] font-semibold">발행 일시</label>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="pub-at"
                  type="datetime-local"
                  value={pubAt}
                  onChange={(e) => setPubAt(e.target.value)}
                  className="field-input py-1.5"
                  style={{ width: 'auto', maxWidth: 240 }}
                />
                <span className="text-[12px] text-muted">한국 시간</span>
                {pubAt
                  ? <button type="button" onClick={() => setPubAt('')} className="text-[12px] text-muted underline underline-offset-2 hover:text-ink">비우기 (발행하는 순간으로)</button>
                  : <span className="text-[12px] text-muted">비워 두면 발행하는 순간</span>}
              </div>
              {(() => {
                const t = fromKstInput(pubAt)
                if (!t) return null
                const diff = Date.parse(t) - Date.now()
                return diff > 60_000
                  ? <p className="mt-1 text-[12px] font-semibold text-[#6D28D9]">예약 발행: {formatDateTime(t)}에 홈페이지에 공개됩니다. 그 전까지는 보이지 않습니다.</p>
                  : diff < -60_000
                    ? <p className="mt-1 text-[12px] text-muted">지난 날짜로 발행됩니다. 기사 날짜와 목록 순서가 이 일시를 따릅니다.</p>
                    : null
              })()}
            </div>
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

        <aside className="min-w-0 rounded-lg border border-line bg-white p-4 md:p-5 lg:sticky lg:top-6">
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

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5 md:px-8 md:py-3">
          {error ? (
            <p role="alert" className="line-clamp-2 min-w-0 flex-1 text-[12.5px] text-danger md:truncate md:text-[13px]">{error}</p>
          ) : (
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => router.back()} className="whitespace-nowrap text-[13px] text-muted hover:text-ink">← 취소</button>
              {article && (
                <form className="hidden md:block" action={deleteArticle.bind(null, article.id)}>
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
          <div className="ml-auto flex shrink-0 gap-1.5 md:gap-2">
            <button type="button" onClick={() => save('draft')} disabled={!!saving} className="btn-secondary px-3 md:px-5">
              {saving === 'draft' ? '저장 중…' : '저장'}
            </button>
            {status !== 'published' && status !== 'in_review' && (
              <button type="button" onClick={() => save('review')} disabled={!!saving} className="btn-review px-3 md:px-5">
                {saving === 'review' ? '신청 중…' : '승인신청'}
              </button>
            )}
            {isEditorPlus && (
              <button type="button" onClick={() => save('publish')} disabled={!!saving} className="btn-publish px-3 md:px-5">
                {saving === 'publish' ? '발행 중…' : status === 'published' ? '수정 내용 반영' : (fromKstInput(pubAt) ?? '') > new Date(Date.now() + 60_000).toISOString() ? '예약 발행' : '바로 발행'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
