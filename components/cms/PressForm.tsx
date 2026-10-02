'use client'

import { useRef, useState } from 'react'
import { useFormState } from 'react-dom'
import Link from 'next/link'
import { uploadImage } from '@/components/editor/upload'
import { DOC_ACCEPT, extractDocText, guessTitle } from '@/lib/doc-extract'
import { createManualPress, type ManualPressState } from '@/app/(main)/press/actions'
import PendingButton from './PendingButton'

type Photo = { url: string; caption: string }

export default function PressForm({ outletId }: { outletId: string | null }) {
  const [state, action] = useFormState<ManualPressState, FormData>(createManualPress, {})
  const fileRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(0)
  const [photoError, setPhotoError] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [docState, setDocState] = useState<{ reading?: boolean; error?: string; name?: string }>({})

  // 한글·워드·텍스트 보도자료 파일 → 본문(한 줄 = 한 문단), 제목이 비어 있으면 제목도 채운다
  //   파일은 서버로 보내지 않고 이 브라우저에서 글자만 읽는다
  async function readDoc(file: File | undefined) {
    if (!file) return
    const body = bodyRef.current
    if (body?.value.trim() && !window.confirm('본문에 적힌 글을 파일 내용으로 바꿀까요?')) return
    setDocState({ reading: true })
    try {
      const text = await extractDocText(file)
      if (body) body.value = text.split('\n').map((l) => l.trim()).filter(Boolean).join('\n\n')
      const title = titleRef.current
      if (title && !title.value.trim()) title.value = guessTitle(text, file.name)
      setDocState({ name: file.name })
    } catch (e) {
      setDocState({ error: e instanceof Error ? e.message : '파일을 읽지 못했습니다.' })
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setPhotoError('')
    const list = Array.from(files)
    setUploading((n) => n + list.length)
    for (const file of list) {
      try {
        const url = await uploadImage(file, outletId)
        setPhotos((prev) => [...prev, { url, caption: '' }])
      } catch (e) {
        setPhotoError(e instanceof Error ? e.message : '사진을 올리지 못했습니다.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-5 rounded-lg border border-line bg-white p-7">
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[120px_1fr] sm:items-center sm:gap-y-4">
          <label htmlFor="source_name" className="text-[13px] font-semibold">보낸 곳 <span className="text-danger">*</span></label>
          <input id="source_name" name="source_name" required maxLength={80} placeholder="예: 서울시 복지정책과, ○○요양병원" className="field-input max-w-md" />

          <label htmlFor="title" className="text-[13px] font-semibold">제목 <span className="text-danger">*</span></label>
          <input ref={titleRef} id="title" name="title" required maxLength={300} placeholder="보도자료 제목" className="field-input" />

          <label htmlFor="link" className="text-[13px] font-semibold">원문 링크</label>
          <input id="link" name="link" inputMode="url" placeholder="있으면 입력 (선택)" className="field-input" />
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="body" className="text-[13px] font-semibold">본문 <span className="text-danger">*</span></label>
            <label className={`btn-secondary cursor-pointer text-[12.5px] ${docState.reading ? 'pointer-events-none opacity-60' : ''}`}>
              {docState.reading ? '읽는 중…' : '파일에서 불러오기 (한글·워드)'}
              <input type="file" accept={DOC_ACCEPT} className="sr-only" onChange={(e) => { readDoc(e.target.files?.[0]); e.target.value = '' }} />
            </label>
          </div>
          <p role={docState.error ? 'alert' : undefined} className={`mb-2 text-[12px] ${docState.error ? 'font-semibold text-danger' : 'text-muted'}`}>
            {docState.error
              ?? (docState.name
                ? `“${docState.name}”에서 글을 불러왔습니다. 표·머리글이 섞였으면 지우고 다듬어 주세요.`
                : '한글(.hwp .hwpx)·워드(.doc .docx) 파일을 불러오거나 여기에 끌어다 놓으세요. 이메일 본문·PDF는 글을 복사해 붙여넣으세요.')}
          </p>
          <textarea
            ref={bodyRef}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault() }}
            onDrop={(e) => { const f = e.dataTransfer.files?.[0]; if (f) { e.preventDefault(); readDoc(f) } }}
            id="body"
            name="body"
            required
            rows={16}
            placeholder={'보도자료 본문을 붙여넣으세요.\n\n문단은 빈 줄로 나누면 그대로 유지됩니다. 문의처·담당자 연락처는 AI 초안에서 빠집니다.'}
            className="field-input resize-y leading-relaxed"
          />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-bold">사진</h2>
            <p className="mt-0.5 text-[12px] text-muted">메일에 첨부된 사진을 내려받아 올리세요. 설명을 적으면 사진 아래 “▲ 설명”으로 들어갑니다.</p>
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary">사진 올리기</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>

        {(photos.length > 0 || uploading > 0) && (
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.url} className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded border border-line bg-[#F8F9FA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute right-1.5 top-1.5 rounded bg-black/60 px-2 py-0.5 text-[12px] text-white hover:bg-black/80"
                    aria-label={`${i + 1}번째 사진 빼기`}
                  >
                    빼기
                  </button>
                </div>
                <input type="hidden" name="photo_url" value={p.url} />
                <label htmlFor={`cap-${i}`} className="sr-only">{i + 1}번째 사진 설명</label>
                <input
                  id={`cap-${i}`}
                  name="photo_caption"
                  value={p.caption}
                  onChange={(e) => setPhotos((prev) => prev.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
                  placeholder="사진 설명 (선택)"
                  className="field-input py-1.5 text-[13px]"
                />
              </li>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <li key={`up-${i}`} className="grid aspect-[4/3] place-items-center rounded border border-dashed border-line text-[12.5px] text-muted">올리는 중…</li>
            ))}
          </ul>
        )}
        {photoError && <p role="alert" className="mt-3 text-[13px] text-danger">{photoError}</p>}
      </div>

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] items-center gap-3 px-4 py-2.5 md:px-8 md:py-3">
          <p role={state.error ? 'alert' : undefined} className={`flex-1 text-[12.5px] ${state.error ? 'font-semibold text-danger' : 'text-muted'}`}>
            {state.error ?? '등록하면 보도자료함에 들어가고, 바로 원문 그대로 또는 AI 초안으로 기사를 만들 수 있습니다.'}
          </p>
          <Link href="/press" className="btn-secondary">취소</Link>
          <PendingButton pending="등록하는 중…" className="btn-publish px-5" disabled={uploading > 0}>
            {uploading > 0 ? '사진 올리는 중…' : '보도자료함에 등록'}
          </PendingButton>
        </div>
      </div>
    </form>
  )
}
