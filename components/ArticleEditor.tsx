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
import PhotoSuggest from './editor/PhotoSuggest'
import { loadWatermark, saveWatermark, uploadImage, type WatermarkPref } from './editor/upload'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'
import PendingButton from './cms/PendingButton'
import { deleteArticle } from '@/app/(main)/articles/actions'
import { checkArticleLegal } from '@/app/(main)/articles/legal'
import LegalDecide, { type Decision } from './cms/LegalDecide'
import LegalReview from './cms/LegalReview'
import CopyLinkButton from './cms/CopyLinkButton'
import type { LegalCheck } from '@/lib/legal-types'
import { canReplaceInEditor, findInText, replaceInEditor, replaceInText } from '@/lib/editor-replace'
import { PREVIEW_STORE, type ArticlePreviewData } from '@/lib/article-preview'

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
  // 언론사 대표 이메일 (기자명 옆 이메일의 기본값). settingsReady: newsroom-settings.sql 실행 여부
  outletEmail?: string | null
  settingsReady?: boolean
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

export default function ArticleEditor({ article, categories, userId, outletId, outletName, authorName, authorEmail, isEditorPlus, outlets, syndicatedOutletIds, sourceOutletName, articleAuthorName, outletEmail = null, settingsReady = false }: Props) {
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
  // 함께 송고할 때 매체마다 AI로 문장을 바꿔 올릴지 (기본 켜짐)
  const [rewriteCopies, setRewriteCopies] = useState(true)
  const [showSeo, setShowSeo] = useState(false)
  // 사진 워터마크 (기본 글자: ⓒ 매체 이름)
  const [watermark, setWatermarkState] = useState<WatermarkPref>({ on: false, text: `ⓒ ${outletName ?? ''}`.trim() })
  useEffect(() => { setWatermarkState(loadWatermark(`ⓒ ${outletName ?? ''}`.trim())) }, [outletName])
  const setWatermark = (v: WatermarkPref) => { setWatermarkState(v); saveWatermark(v) }
  const [saving, setSaving] = useState<Mode | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')
  const defaultName = (article ? articleAuthorName : authorName) ?? ''
  const [byline, setByline] = useState(article?.byline?.trim() || defaultName)
  const shownName = useRef(byline)
  // 기자명 옆 이메일: 기자는 언론사 대표 이메일로 고정, 편집장 이상은 기사마다 바꿀 수 있다
  const savedEmail = (article as { byline_email?: string | null } | undefined)?.byline_email ?? null
  const [bylineEmail, setBylineEmail] = useState(savedEmail ?? outletEmail ?? '')
  // AI 법적 검수 (원할 때 “AI 검수” 버튼으로). 같은 내용으로 이미 검수했으면 다시 하지 않는다
  const [checking, setChecking] = useState(false)
  const [legal, setLegal] = useState<{ check: LegalCheck; key: string } | null>(null)
  const [legalOpen, setLegalOpen] = useState(false)
  // 미리보기 창 (mode가 있으면 승인신청·발행 직전 단계, null이면 그냥 보기)
  const [preview, setPreview] = useState<{ mode: Mode | null; n: number } | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'pc' | 'mobile'>('pc')

  const status: ArticleStatus = article?.status ?? 'draft'
  const isMine = !article || article.author_id === userId
  const isCopy = !!article?.source_article_id
  const ownOutlet = article?.outlet_id ?? outletId
  const otherOutlets = outlets.filter((o) => o.id !== ownOutlet)

  // 이미 저장된 기사 ID (새 기사는 “저장”을 누를 때 만든다)
  const draftId = article?.id ?? null

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
    // 기자는 보내지 않는다 (DB가 대표 이메일로 채운다)
    if (settingsReady && isEditorPlus) payload.byline_email = bylineEmail.trim() || outletEmail || null
    return payload
  }

  // “AI 검수” 버튼: 법적 위험 표현을 찾아 항목마다 바꿀지 고르게 한다 (승인신청·발행과는 따로)
  async function runLegal() {
    if (!validate()) return
    if (legal && legal.key === legalKey) { setLegalOpen(true); return }
    setChecking(true)
    setError('')
    const r = await checkArticleLegal({ title: title.trim(), subtitle: subtitle.trim(), html, outletId: ownOutlet, articleId: article?.id ?? draftId })
    setChecking(false)
    if (!r.ok) { setError(r.skipped ? r.error : `AI 검수를 하지 못했습니다: ${r.error}`); return }
    setLegal({ check: r.check, key: legalKey })
    setLegalOpen(true)
  }
  // forSubmit: 승인신청·발행할 때는 섹션도 꼭 골라야 한다 (저장·미리보기는 섹션 없이도 된다)
  function validate(forSubmit = false) {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return false }
    if (forSubmit && !categoryId) {
      setError('섹션을 골라 주세요. 섹션이 없으면 승인신청·발행할 수 없습니다.')
      document.getElementById('section')?.focus()
      return false
    }
    if (!charCount) { setError('본문을 입력해주세요.'); return false }
    if (pubAt && !fromKstInput(pubAt)) { setError('발행 일시를 확인해 주세요.'); return false }
    return true
  }

  // 승인신청·발행: 홈페이지 모양 미리보기 → 제출 (AI 검수는 원할 때 따로)
  function submit(mode: 'review' | 'publish') {
    if (!validate(true)) return
    openPreview(mode)
  }

  function previewData(over: { title?: string; subtitle?: string } = {}): ArticlePreviewData {
    const cat = categories.find((c) => c.id === categoryId)
    return {
      title: (over.title ?? title).trim(),
      subtitle: (over.subtitle ?? subtitle).trim(),
      html: editorRef.current?.getHTML() ?? html,
      category: cat ? { name: cat.name, slug: cat.slug } : null,
      author: byline.trim() || defaultName,
      email: settingsReady ? (isEditorPlus ? bylineEmail.trim() || outletEmail : savedEmail ?? outletEmail) || null : null,
      publishedAt: fromKstInput(pubAt) ?? new Date().toISOString(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      thumbnail: thumbnailUrl || null,
    }
  }

  function openPreview(mode: Mode | null) {
    try { sessionStorage.setItem(PREVIEW_STORE, JSON.stringify(previewData())) } catch { /* 저장 공간이 없으면 빈 미리보기 */ }
    setPreview({ mode, n: Date.now() })
  }

  // 검수 항목마다 고른 대로 기사를 고친다
  function applyDecisions(decisions: Decision[]) {
    if (!legal) return
    const editor = editorRef.current
    let t = title
    let sub = subtitle
    const issues = legal.check.issues.map((x, i) => {
      let decision: Decision = decisions[i] ?? 'kept'
      if (decision === 'fixed' && x.fix) {
        const nt = replaceInText(t, x.quote, x.fix)
        const ns = nt == null ? replaceInText(sub, x.quote, x.fix) : null
        if (nt != null) t = nt
        else if (ns != null) sub = ns
        else if (!(editor && replaceInEditor(editor, x.quote, x.fix))) decision = 'kept'
      } else decision = 'kept'
      return { ...x, decision }
    })
    if (t !== title) setTitle(t)
    if (sub !== subtitle) setSubtitle(sub)
    const check = { ...legal.check, issues, reused: undefined }
    // 고친 뒤 내용 기준으로 "이미 골랐음"을 기억한다 (아래 effect가 새 내용의 key를 붙인다)
    setLegal({ check, key: '__pending__' })
    setLegalOpen(false)
  }

  async function save(mode: Mode) {
    const legalCheck = mode === 'draft' ? null : currentLegal
    if (!validate(mode !== 'draft')) return
    const chosenAt = fromKstInput(pubAt)
    // 지금 발행은 미리보기에서 확인했으니 다시 묻지 않고, 예약·지난 날짜만 한 번 더 확인한다
    if (mode === 'publish' && chosenAt) {
      const when = new Date(chosenAt).getTime()
      const msg = when > Date.now() + 60_000
        ? `${formatDateTime(chosenAt)}에 홈페이지에 공개되도록 예약 발행할까요?\n그 전까지는 홈페이지에 보이지 않습니다.`
        : when < Date.now() - 60_000
          ? `발행 일시를 ${formatDateTime(chosenAt)}(지난 날짜)로 해서 발행할까요?`
          : null
      if (msg && !window.confirm(msg)) return
    }
    setError('')
    setSaving(mode)

    const payload = contentPayload()
    if (legalCheck && settingsReady) { const { reused: _r, ...lc } = legalCheck; payload.legal_check = lc; payload.legal_checked_at = legalCheck.checked_at ?? new Date().toISOString() }
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
    // 저장했으니 이 브라우저의 임시 저장은 지운다
    clearLocalBackup()
    setRestored(null)
    setTempSavedAt(null)
    serverKey.current = contentKey

    // 승인신청이면 편집장들에게 알림 메일 (메일 설정 전이면 아무 일도 하지 않는다)
    if (id && mode === 'review') notifyArticle(id, 'submitted').catch(() => {})

    const livePublished = mode === 'publish' || (mode === 'draft' && status === 'published')
    if (id && livePublished && !isCopy && syndicateTo.length) {
      try {
        const summary = describe(await syndicate(id, { rewrite: rewriteCopies }))
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

  // ───────── 자동 임시 저장 ─────────
  // 쓰는 내용은 고칠 때마다 이 브라우저에만 바로 임시 저장한다 (기사목록에는 들어가지 않는다)
  //   컴퓨터가 꺼지거나 브라우저가 닫혀도 다시 기사쓰기(또는 그 기사 수정)를 열면 그대로 이어서 나온다
  //   “저장”을 누르면 기사목록에 들어가고 임시 저장은 지운다
  const backupKey = article ? `im-autosave-${article.id}` : `im-autosave-new-${userId}-${outletId ?? 'none'}`
  // 법적 검수는 제목·부제·본문만 본다 (태그·일시만 바꿨으면 다시 검수하지 않는다)
  const legalKey = JSON.stringify([title.trim(), subtitle.trim(), html])
  useEffect(() => {
    if (legal?.key === '__pending__') setLegal({ ...legal, key: legalKey })
  }, [legal, legalKey])
  // 지금 내용 그대로 검수한 결과가 있으면 승인신청·발행할 때 같이 저장한다
  const currentLegal = legal && legal.key === legalKey ? legal.check : null
  const contentKey = JSON.stringify([title, subtitle, html, categoryId, tags, byline, bylineEmail, pubAt, metaTitle, metaDesc, isFeatured, thumbnailUrl])
  const serverKey = useRef(contentKey)
  // 임시 저장을 불러왔을 때: 불러온 시각과, 되돌릴 때 쓸 원래 내용
  const [restored, setRestored] = useState<{ at: number; original: Record<string, unknown> } | null>(null)
  const [tempSavedAt, setTempSavedAt] = useState<number | null>(null)

  function clearLocalBackup() {
    try { localStorage.removeItem(backupKey) } catch {}
  }

  const snapshot = () => ({ title, subtitle, html: editorRef.current?.getHTML() ?? html, categoryId, tags, byline, bylineEmail, pubAt, metaTitle, metaDesc, isFeatured, thumbnailUrl })

  function applySnapshot(d: Record<string, any>) {
    setTitle(d.title ?? ''); setSubtitle(d.subtitle ?? ''); setCategoryId(d.categoryId ?? ''); setTags(d.tags ?? '')
    setByline(d.byline ?? defaultName); setPubAt(d.pubAt ?? ''); setMetaTitle(d.metaTitle ?? ''); setMetaDesc(d.metaDesc ?? '')
    setIsFeatured(!!d.isFeatured); setThumbnailUrl(d.thumbnailUrl ?? '')
    if (isEditorPlus && typeof d.bylineEmail === 'string') setBylineEmail(d.bylineEmail)
    if (typeof d.html === 'string') { editorRef.current?.commands.setContent(d.html, true); setHtml(d.html) }
  }

  // 편집기가 준비되면(본문 정리가 끝난 뒤) 지금 내용을 기준으로 삼고, 임시 저장이 있으면 바로 불러온다
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready) return
    serverKey.current = contentKey
    try {
      const raw = localStorage.getItem(backupKey)
      if (!raw) return
      const b = JSON.parse(raw) as { at: number; key: string; data: Record<string, unknown> }
      // 그 뒤에 기사가 따로 저장됐으면(다른 컴퓨터 등) 오래된 임시 저장은 버린다
      const stale = article && Date.parse(article.updated_at) > b.at
      if (stale || b.key === serverKey.current) { localStorage.removeItem(backupKey); return }
      const original = snapshot()
      applySnapshot(b.data)
      shownName.current = (typeof b.data.byline === 'string' && b.data.byline.trim()) || defaultName
      setRestored({ at: b.at, original })
      setTempSavedAt(b.at)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  function writeBackup() {
    if (!ready || contentKey === serverKey.current) return
    try {
      const at = Date.now()
      localStorage.setItem(backupKey, JSON.stringify({ at, key: contentKey, data: snapshot() }))
      setTempSavedAt(at)
    } catch {}
  }
  const writeRef = useRef(writeBackup)
  writeRef.current = writeBackup

  // 고칠 때마다 0.8초 뒤 임시 저장
  useEffect(() => {
    if (!ready) return
    if (contentKey === serverKey.current) { clearLocalBackup(); return }
    const t = setTimeout(() => writeRef.current(), 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey, ready])

  // 창을 닫거나 다른 탭으로 갈 때는 기다리지 않고 바로 임시 저장
  useEffect(() => {
    const flush = () => writeRef.current()
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', onHide) }
  }, [])

  // 불러온 임시 저장을 버리고 원래(마지막으로 저장한) 내용으로
  function discardRestored() {
    if (!restored) return
    applySnapshot(restored.original as Record<string, any>)
    shownName.current = (restored.original.byline as string)?.trim() || defaultName
    clearLocalBackup()
    setRestored(null)
    setTempSavedAt(null)
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
            {article?.id
              ? <CopyLinkButton articleId={article.id} label="🔗 기사 링크 복사" className="rounded border border-line px-2 py-0.5 text-[12px] text-muted hover:border-ink hover:text-ink" />
              : <span className="text-[11.5px] text-muted">저장하면 기사 링크를 받을 수 있습니다</span>}
            <span className="text-[11.5px] text-muted md:ml-auto" aria-live="polite">
              {tempSavedAt && contentKey !== serverKey.current
                ? `${new Date(tempSavedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 이 브라우저에 임시 저장됨 · “저장”을 눌러야 기사목록에 들어갑니다`
                : '쓰는 내용은 이 브라우저에 자동 임시 저장됩니다'}
            </span>
            {status === 'rejected' && article?.reject_reason && (
              <p className="w-full rounded border border-danger/30 bg-danger/5 px-3 py-2 text-[13px] text-danger">
                <strong>반려 사유:</strong> {article.reject_reason}
              </p>
            )}
          </div>

          {restored && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded border border-[#2F6BF0]/40 bg-[#2F6BF0]/5 px-4 py-3 text-[13px]">
              <span className="min-w-0 flex-1">
                <strong className="text-[#2F6BF0]">임시 저장된 내용을 불러왔습니다.</strong>{' '}
                {new Date(restored.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}에 이 브라우저에 저장된 내용입니다. 이어서 쓰세요.
              </span>
              <button type="button" onClick={() => setRestored(null)} className="btn-primary px-3 py-1.5 text-[12.5px]">확인</button>
              <button
                type="button"
                onClick={() => { if (window.confirm(article ? '임시 저장된 내용을 버리고 마지막으로 저장한 기사로 되돌릴까요?' : '임시 저장된 내용을 지우고 새로 쓸까요?')) discardRestored() }}
                className="text-[12.5px] text-muted underline underline-offset-2 hover:text-danger"
              >
                {article ? '버리고 저장된 기사로' : '지우고 새로 쓰기'}
              </button>
            </div>
          )}

          {legal && !legalOpen && legal.check.issues.some((x) => !x.decision) && legal.key === legalKey && (
            <div className="rounded border border-danger/30 bg-danger/5 px-4 py-3 text-[13px]">
              <p className="flex flex-wrap items-center gap-2"><strong className="text-danger">AI 법적 검수: 확인할 곳 {legal.check.issues.length}개</strong><button type="button" onClick={() => setLegalOpen(true)} className="text-[12.5px] underline underline-offset-2">다시 보기</button></p>
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
            <label htmlFor="section" className="text-[13px] font-semibold">섹션 <span className="text-danger" aria-hidden>*</span></label>
            <select id="section" required aria-required="true" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); if (e.target.value && /섹션/.test(error)) setError('') }} className={`field-input max-w-xs ${!categoryId && /섹션/.test(error) ? 'border-danger' : ''}`}>
              <option value="">섹션 선택</option>
              {/* 2차 메뉴는 상위 섹션 바로 아래에 '상위 › 하위' 로 */}
              {orderedCategories(categories).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>

            <label htmlFor="byline" className="text-[13px] font-semibold">기자명</label>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded border border-line focus-within:border-ink">
                  <input
                    id="byline"
                    value={byline}
                    onChange={(e) => setByline(e.target.value)}
                    onBlur={() => syncBylineInBody()}
                    maxLength={30}
                    placeholder={defaultName || '기자 이름'}
                    className="w-32 bg-transparent px-3 py-2 outline-none"
                  />
                  <span className="pr-3 text-muted">기자</span>
                </div>
                {settingsReady ? (
                  isEditorPlus ? (
                    <>
                      <label htmlFor="byline-email" className="sr-only">기자 이메일</label>
                      <input
                        id="byline-email"
                        type="email"
                        value={bylineEmail}
                        onChange={(e) => setBylineEmail(e.target.value)}
                        placeholder={outletEmail ?? '기자 이메일'}
                        maxLength={120}
                        className="field-input py-2"
                        style={{ width: 210 }}
                      />
                    </>
                  ) : (
                    <span title="언론사 대표 이메일 (편집장이 바꿀 수 있습니다)" className="max-w-full truncate rounded border border-line bg-[#F8F9FA] px-3 py-2 text-muted">
                      {savedEmail ?? outletEmail ?? '대표 이메일 미설정'}
                    </span>
                  )
                ) : (
                  isMine && authorEmail && <span className="max-w-full truncate rounded border border-line bg-[#F8F9FA] px-3 py-2 text-muted">{authorEmail}</span>
                )}
                {byline.trim() && byline.trim() !== defaultName && (
                  <button type="button" onClick={() => { setByline(defaultName); syncBylineInBody(defaultName) }} className="text-[12px] text-muted underline underline-offset-2 hover:text-ink">
                    {defaultName}(으)로 되돌리기
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 md:ml-auto">
                <label htmlFor="pub-at" className="text-[13px] font-semibold">발행 일시</label>
                <input
                  id="pub-at"
                  type="datetime-local"
                  value={pubAt}
                  onChange={(e) => setPubAt(e.target.value)}
                  title="비우면 발행하는 순간의 시각으로 정해집니다"
                  className="field-input py-1.5"
                  style={{ width: 'auto', maxWidth: 210 }}
                />
                {pubAt && <button type="button" onClick={() => setPubAt('')} className="text-[12px] text-muted underline underline-offset-2 hover:text-ink">비우기</button>}
              </div>
            </div>
            {(() => {
              const t = fromKstInput(pubAt)
              if (!t) return null
              const diff = Date.parse(t) - Date.now()
              const msg = diff > 60_000
                ? <p className="text-[12px] font-semibold text-[#6D28D9]">예약 발행: {formatDateTime(t)}(한국 시간)에 홈페이지에 공개됩니다. 그 전까지는 보이지 않습니다.</p>
                : diff < -60_000
                  ? <p className="text-[12px] text-muted">지난 날짜로 발행됩니다. 기사 날짜와 목록 순서가 이 일시를 따릅니다.</p>
                  : null
              return msg && <><span />{msg}</>
            })()}
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
                const url = await uploadImage(file, outletId, watermark.on ? watermark.text : null)
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
              <label className="mt-3 flex cursor-pointer items-start gap-2 text-[13px]">
                <input type="checkbox" checked={rewriteCopies} onChange={(e) => setRewriteCopies(e.target.checked)} className="mt-0.5" />
                <span><strong className="font-semibold">AI로 문장을 바꿔서 올리기</strong> <span className="text-muted">— 매체마다 제목·본문 표현을 다르게 바꿉니다(사실·숫자·인용은 그대로). 매체 하나에 AI 사용 1회</span></span>
              </label>
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
            watermark={watermark}
            setWatermark={setWatermark}
          />
          {/* AI 검수가 고른 검색어로 공개 라이선스 사진을 찾아 준다 */}
          <PhotoSuggest
            keywords={legal?.check.photo_keywords ?? []}
            fallback={tags.split(',').map((t) => t.trim()).filter(Boolean)[0] ?? ''}
            onAdd={(img) => {
              setImages((prev) => (prev.some((p) => p.url === img.url) ? prev : [...prev, img]))
              if (!thumbnailUrl) setThumbnailUrl(img.url)
            }}
          />
        </aside>
      </div>

      {legalOpen && legal && (
        <div role="dialog" aria-modal="true" aria-labelledby="legal-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-6">
          <div className="max-h-[88vh] w-full max-w-[680px] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:rounded-2xl md:p-7">
            <h2 id="legal-title" className="text-[18px] font-bold">AI 법적 검수 결과</h2>
            {legal.check.issues.length > 0 && legal.check.issues.every((x) => x.decision) ? (
              // 이미 항목마다 고른 결과를 다시 볼 때
              <>
                <p className="mb-4 mt-1 text-[13px] text-muted">고른 대로 반영된 결과입니다. 승인신청·발행할 때 이 기록이 함께 저장됩니다.</p>
                <LegalReview check={legal.check} compact />
                <div className="mt-5 flex justify-end border-t border-line pt-4">
                  <button type="button" onClick={() => setLegalOpen(false)} className="btn-primary px-5" autoFocus>닫기</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-4 mt-1 text-[13px] text-muted">
                  {legal.check.issues.length
                    ? '명예훼손·개인정보·저작권(도용) 등 문제가 될 수 있는 부분입니다. 항목마다 AI가 고친 문장으로 바꿀지, 그대로 둘지 골라 주세요.'
                    : '명예훼손·개인정보·저작권(도용) 등을 살펴봤습니다.'}
                </p>
                <LegalDecide
                  check={legal.check}
                  fixable={legal.check.issues.map((x) => !!x.fix && (!!findInText(title, x.quote) || !!findInText(subtitle, x.quote) || canReplaceInEditor(editorRef.current, x.quote)))}
                  next="완료"
                  onDone={applyDecisions}
                  onEdit={() => setLegalOpen(false)}
                />
              </>
            )}
          </div>
        </div>
      )}

      {preview && (
        <div role="dialog" aria-modal="true" aria-label="기사 미리보기" className="fixed inset-0 z-[80] flex flex-col bg-[#14171C]/85">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-white px-4 py-2.5 md:gap-3 md:px-6">
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-bold">미리보기</p>
              <p className="truncate text-[12px] text-muted">
                홈페이지에 이렇게 보입니다{preview.mode ? ' · 고칠 곳이 있으면 “고치러 가기”를 누르세요' : ''}
                {preview.mode && (currentLegal ? ' · AI 검수 완료' : ' · AI 검수를 하지 않았습니다')}
              </p>
            </div>
            <div role="group" aria-label="화면 크기" className="inline-flex rounded-md border border-line p-0.5 text-[12.5px] font-semibold">
              {([['pc', 'PC'], ['mobile', '모바일']] as const).map(([d, label]) => (
                <button key={d} type="button" aria-pressed={previewDevice === d} onClick={() => setPreviewDevice(d)} className={`rounded px-3 py-1 ${previewDevice === d ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{label}</button>
              ))}
            </div>
            {article?.id && <CopyLinkButton articleId={article.id} className="btn-secondary hidden px-3 md:inline-flex md:px-4" />}
            <button type="button" onClick={() => setPreview(null)} className="btn-secondary px-3 md:px-4" autoFocus={!preview.mode}>
              {preview.mode ? '← 고치러 가기' : '닫기'}
            </button>
            {preview.mode && (
              <button
                type="button"
                onClick={() => { const m = preview.mode!; setPreview(null); save(m) }}
                className={`${preview.mode === 'publish' ? 'btn-publish' : 'btn-review'} px-4 md:px-5`}
                autoFocus
              >
                {preview.mode === 'publish' ? (status === 'published' ? '수정 내용 반영' : (fromKstInput(pubAt) ?? '') > new Date(Date.now() + 60_000).toISOString() ? '예약 발행하기' : '발행하기') : '승인신청하기'}
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-0 md:p-4">
            <iframe
              key={preview.n}
              title="홈페이지 미리보기"
              src={`/preview/article?outlet=${ownOutlet ?? ''}&c=${encodeURIComponent(categories.find((c) => c.id === categoryId)?.slug ?? '')}&n=${preview.n}`}
              className={`mx-auto block h-full border-0 bg-white ${previewDevice === 'mobile' ? 'w-[390px] max-w-full md:rounded-xl md:shadow-2xl' : 'w-full md:rounded-lg'}`}
            />
          </div>
        </div>
      )}

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-2.5 md:px-8 md:py-3">
          {error ? (
            <p role="alert" className="line-clamp-2 min-w-0 flex-1 text-[12.5px] text-danger md:truncate md:text-[13px]">{error}</p>
          ) : (
            <div className="hidden items-center gap-4 md:flex">
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
            <button type="button" onClick={() => { if (validate()) openPreview(null) }} disabled={!!saving} className="btn-secondary px-2.5 md:px-5">
              미리보기
            </button>
            {/* 저장 = 기사목록에 들어간다 (쓰는 중인 내용은 따로 이 브라우저에 자동 임시 저장) */}
            <button type="button" onClick={() => save('draft')} disabled={!!saving} className="btn-secondary px-2.5 md:px-5">
              {saving === 'draft' ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={runLegal}
              disabled={!!saving || checking}
              title="명예훼손·저작권(도용)·개인정보 등 법적으로 문제가 될 표현을 AI가 찾아 줍니다 (AI 사용 1회)"
              className={`btn-secondary whitespace-nowrap px-2.5 md:px-5 ${currentLegal ? 'border-published/50 text-published' : ''}`}
            >
              {checking ? '검수 중…' : currentLegal ? 'AI 검수 ✓' : 'AI 검수'}
            </button>
            {status !== 'published' && status !== 'in_review' && (
              <button type="button" onClick={() => submit('review')} disabled={!!saving || checking} className="btn-review px-2.5 md:px-5">
                {saving === 'review' ? '신청 중…' : '승인신청'}
              </button>
            )}
            {isEditorPlus && (
              <button type="button" onClick={() => submit('publish')} disabled={!!saving || checking} className="btn-publish px-2.5 md:px-5">
                {saving === 'publish' ? '발행 중…' : status === 'published' ? '수정 내용 반영' : (fromKstInput(pubAt) ?? '') > new Date(Date.now() + 60_000).toISOString() ? '예약 발행' : '바로 발행'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 섹션 고르기 목록: 1차 섹션 다음에 그 2차 메뉴를 붙인다
function orderedCategories(categories: Category[]) {
  const slugs = new Set(categories.map((c) => c.slug))
  const isTop = (c: Category) => !c.parent_slug || !slugs.has(c.parent_slug)
  const out: { id: string; label: string }[] = []
  for (const top of categories.filter(isTop)) {
    out.push({ id: top.id, label: top.name })
    for (const k of categories.filter((c) => c.parent_slug === top.slug)) out.push({ id: k.id, label: `${top.name} › ${k.name}` })
  }
  return out
}
