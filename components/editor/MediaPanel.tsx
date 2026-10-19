'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { formatBytes, storageLimitBytes } from '@/lib/storage-quota'
import { storagePath } from '@/lib/data-export'
import { ImageIcon, VideoIcon } from '@/components/cms/icons'
import { uploadImage, uploadVideo, VIDEO_ACCEPT, VIDEO_MAX_BYTES, type UploadedVideo, type WatermarkPref } from './upload'

export type LibraryImage = { url: string; caption: string }

type Props = {
  outletId: string | null
  images: LibraryImage[]
  setImages: (fn: (prev: LibraryImage[]) => LibraryImage[]) => void
  thumbnailUrl: string
  onInsertImage: (img: LibraryImage) => void
  onSetThumbnail: (url: string) => void
  onInsertYoutube: (url: string) => boolean
  // 직접 올린 영상: 올리기가 끝나면 본문 커서 자리에 넣는다
  onInsertVideo: (v: UploadedVideo) => void
  // 지금 본문에 쓰인 사진 주소 (본문에 있는 사진은 목록에서 지울 수 없다)
  usedInBody: string[]
  watermark: WatermarkPref
  setWatermark: (v: WatermarkPref) => void
}

export default function MediaPanel({ outletId, images, setImages, thumbnailUrl, onInsertImage, onSetThumbnail, onInsertYoutube, onInsertVideo, usedInBody, watermark, setWatermark }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [youtube, setYoutube] = useState('')
  const videoRef = useRef<HTMLInputElement>(null)
  // 이 창에서 올린 사진 / 본문에 넣어 본 사진: 올리기만 하고 한 번도 안 쓴 사진은 저장소 파일까지 지운다
  const uploadedHere = useRef(new Set<string>())
  const insertedHere = useRef(new Set<string>())
  const [videoPct, setVideoPct] = useState<number | null>(null)
  // 저장 용량(사진+영상) 사용량: 요금제 한도와 비교한다. 집계 SQL이 아직 없으면 숨긴다
  const [usage, setUsage] = useState<{ used: number; videos: number; limit: number | null } | null>(null)
  const refreshUsage = useCallback(async () => {
    if (!outletId) return
    const supabase = createClient()
    const [{ data: u, error }, { data: o }] = await Promise.all([
      supabase.rpc('outlet_storage_bytes', { o: outletId }),
      supabase.from('outlets').select('plan').eq('id', outletId).maybeSingle(),
    ])
    const row = Array.isArray(u) ? u[0] : u
    if (error || !row) return setUsage(null)
    setUsage({ used: Number(row.photos ?? 0) + Number(row.videos ?? 0), videos: Number(row.videos ?? 0), limit: storageLimitBytes((o as { plan?: string | null } | null)?.plan) })
  }, [outletId])
  useEffect(() => { refreshUsage() }, [refreshUsage])

  async function handleVideo(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setError('')
    if (usage?.limit && usage.used + file.size > usage.limit) {
      setError(`저장 용량(${formatBytes(usage.limit)})을 넘습니다. 지금 ${formatBytes(usage.used)} 사용 중입니다. 쓰지 않는 영상·사진을 정리하거나 요금제를 올려 주세요.`)
      return
    }
    setVideoPct(0)
    try {
      const v = await uploadVideo(file, outletId, setVideoPct)
      onInsertVideo(v)
      refreshUsage()
    } catch (e) {
      setError(e instanceof Error ? e.message : '영상을 올리지 못했습니다.')
    } finally {
      setVideoPct(null)
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const list = Array.from(files)
    setUploading((n) => n + list.length)
    for (const file of list) {
      try {
        const url = await uploadImage(file, outletId, watermark.on ? watermark.text : null)
        uploadedHere.current.add(url)
        setImages((prev) => [...prev, { url, caption: '' }])
        if (!thumbnailUrl) onSetThumbnail(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : '사진을 올리지 못했습니다.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
  }

  async function removePhoto(img: LibraryImage) {
    setError('')
    if (usedInBody.includes(img.url)) { setError('본문에 쓰인 사진입니다. 본문에서 사진을 먼저 지워 주세요.'); return }
    const fileToo = uploadedHere.current.has(img.url) && !insertedHere.current.has(img.url)
    if (!window.confirm(fileToo ? '이 사진을 지울까요? 올린 파일도 함께 삭제됩니다.' : '이 사진을 목록에서 뺄까요? (이미 저장된 기사나 수정 이력에서 쓰는 사진 파일은 그대로 둡니다)')) return
    setImages((prev) => prev.filter((p) => p.url !== img.url))
    if (thumbnailUrl === img.url) onSetThumbnail('')
    if (fileToo) {
      const path = storagePath(img.url)
      if (path) {
        const { data: gone, error: rmErr } = await createClient().storage.from('media').remove([path])
        // 저장소가 0건으로 답하면 파일이 남은 것이다 (조회 권한이 없을 때 오류 없이 이렇게 끝난다)
        if (rmErr || !gone?.length) setError('목록에서는 뺐지만 저장소 파일은 지우지 못했습니다. 저장 파일 화면에서 다시 지워 보세요.')
        refreshUsage()
      }
    }
  }

  function addYoutube() {
    if (!youtube.trim()) return
    if (onInsertYoutube(youtube.trim())) {
      setYoutube('')
      setError('')
    } else {
      setError('유튜브 주소를 확인해 주세요. 예: https://www.youtube.com/watch?v=...')
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold"><ImageIcon /> 사진</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`w-full rounded border-2 border-dashed px-4 py-6 text-center text-[12.5px] leading-relaxed transition-colors ${
            dragging ? 'border-review bg-review/5 text-review' : 'border-line text-muted hover:border-ink/40'
          }`}
        >
          {uploading > 0 ? `올리는 중… (${uploading}장)` : <>사진을 끌어다 놓거나 <b className="text-ink">클릭</b>해서 선택하세요<br />여러 장 가능 · 큰 사진은 자동으로 줄여서 올립니다</>}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
        {/* 워터마크: 켜 두면 이제부터 올리는 사진 오른쪽 아래에 글자가 들어간다 (이미 올린 사진은 그대로) */}
        <div className="mt-2.5 rounded border border-line bg-paper px-3 py-2 text-[12.5px]">
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input type="checkbox" checked={watermark.on} onChange={(e) => setWatermark({ ...watermark, on: e.target.checked })} />
            사진에 워터마크 넣기
          </label>
          {watermark.on && (
            <div className="mt-1.5">
              <label htmlFor="wm-text" className="sr-only">워터마크 글자</label>
              <input id="wm-text" value={watermark.text} maxLength={30} onChange={(e) => setWatermark({ ...watermark, text: e.target.value })} className="field-input py-1.5 text-[12.5px]" />
              <p className="mt-1 text-[11.5px] leading-snug text-muted">이제부터 올리는 사진 오른쪽 아래에 들어갑니다. 이미 올린 사진·보도자료 사진에는 들어가지 않습니다.</p>
            </div>
          )}
        </div>

        {images.length > 0 && (
          <ul className="mt-3 space-y-3">
            {images.map((img, i) => (
              <li key={img.url} className="rounded border border-line bg-white p-2">
                <div className="relative">
                  <img src={img.url} alt="" className="aspect-[3/2] w-full rounded-sm object-cover" />
                  {thumbnailUrl === img.url && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 text-[10.5px] font-semibold text-white">대표 사진</span>
                  )}
                </div>
                <label className="sr-only" htmlFor={`cap-${i}`}>사진 설명</label>
                <input
                  id={`cap-${i}`}
                  value={img.caption}
                  onChange={(e) => setImages((prev) => prev.map((p) => (p.url === img.url ? { ...p, caption: e.target.value } : p)))}
                  placeholder="사진 설명 (예: 사진=더케어타임즈)"
                  className="mt-2 w-full rounded border border-line px-2 py-1.5 text-[12.5px] outline-none focus:border-ink"
                />
                <div className="mt-2 flex gap-1.5">
                  <button type="button" onClick={() => { insertedHere.current.add(img.url); onInsertImage(img) }} className="flex-1 rounded bg-ink py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
                    본문에 넣기
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetThumbnail(img.url)}
                    disabled={thumbnailUrl === img.url}
                    className="flex-1 rounded border border-line py-1.5 text-[12px] hover:bg-line/50 disabled:opacity-40"
                  >
                    대표로 지정
                  </button>
                  <button type="button" onClick={() => removePhoto(img)} aria-label="이 사진 지우기" className="rounded border border-danger/40 px-3 py-1.5 text-[12px] text-danger hover:bg-danger/5">
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-5">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold"><VideoIcon /> 영상</h3>
        <button
          type="button"
          disabled={videoPct !== null}
          onClick={() => videoRef.current?.click()}
          className="w-full rounded border-2 border-dashed border-line px-4 py-4 text-center text-[12.5px] leading-relaxed text-muted transition-colors hover:border-ink/40 disabled:opacity-70"
        >
          {videoPct !== null
            ? <>영상 올리는 중… {videoPct}%<span className="mt-1.5 block h-1.5 overflow-hidden rounded bg-line"><span className="block h-full bg-review transition-[width]" style={{ width: `${videoPct}%` }} /></span><span className="mt-1 block text-[11.5px]">창을 닫지 말고 기다려 주세요</span></>
            : <><b className="text-ink">영상 파일 올리기</b> (MP4·MOV·WEBM, {formatBytes(VIDEO_MAX_BYTES)} 이하)<br />올리면 본문 커서 자리에 바로 들어갑니다</>}
        </button>
        <input ref={videoRef} type="file" accept={VIDEO_ACCEPT} hidden onChange={(e) => { handleVideo(e.target.files); e.target.value = '' }} />
        <p className="mt-1.5 text-[11.5px] leading-snug text-muted">변환 없이 그대로 올라갑니다. 휴대폰은 설정에서 “호환성 우선(MP4·H.264)”으로 찍으면 어느 기기에서나 재생됩니다. 화질이 높으면 독자 휴대폰에서 느릴 수 있으니 1080p 이하를 권합니다.</p>
        {usage && (
          <div className="mt-2 text-[11.5px] text-muted" aria-live="polite">
            저장 용량 {formatBytes(usage.used)}{usage.limit ? ` / ${formatBytes(usage.limit)}` : ''} 사용 (사진+영상{usage.videos ? `, 영상 ${formatBytes(usage.videos)}` : ''})
            {usage.limit && (
              <span className="mt-1 block h-1.5 overflow-hidden rounded bg-line"><span className={`block h-full ${usage.used / usage.limit >= 0.8 ? 'bg-danger' : 'bg-review'}`} style={{ width: `${Math.min(100, Math.round((usage.used / usage.limit) * 100))}%` }} /></span>
            )}
            {usage.limit && usage.used / usage.limit >= 0.8 && <span className="mt-1 block text-danger">용량이 {usage.used >= usage.limit ? '가득 찼습니다' : '80%를 넘었습니다'}. 쓰지 않는 파일을 정리해 주세요.</span>}
          </div>
        )}
        <div className="mt-3 flex gap-1.5">
          <label htmlFor="yt" className="sr-only">유튜브 주소</label>
          <input
            id="yt"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addYoutube() } }}
            placeholder="유튜브 영상 주소"
            className="min-w-0 flex-1 rounded border border-line px-2.5 py-2 text-[12.5px] outline-none focus:border-ink"
          />
          <button type="button" onClick={addYoutube} className="rounded bg-[#4A5060] px-3 text-[12px] font-semibold text-white hover:opacity-90">
            넣기
          </button>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">본문에서 커서가 있는 곳에 들어갑니다.</p>
      </section>

      {error && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}
