'use client'

import { useRef, useState } from 'react'
import { ImageIcon, VideoIcon } from '@/components/cms/icons'
import { uploadImage } from './upload'

export type LibraryImage = { url: string; caption: string }

type Props = {
  outletId: string | null
  images: LibraryImage[]
  setImages: (fn: (prev: LibraryImage[]) => LibraryImage[]) => void
  thumbnailUrl: string
  onInsertImage: (img: LibraryImage) => void
  onSetThumbnail: (url: string) => void
  onInsertYoutube: (url: string) => boolean
}

export default function MediaPanel({ outletId, images, setImages, thumbnailUrl, onInsertImage, onSetThumbnail, onInsertYoutube }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState('')
  const [youtube, setYoutube] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setError('')
    const list = Array.from(files)
    setUploading((n) => n + list.length)
    for (const file of list) {
      try {
        const url = await uploadImage(file, outletId)
        setImages((prev) => [...prev, { url, caption: '' }])
        if (!thumbnailUrl) onSetThumbnail(url)
      } catch (e) {
        setError(e instanceof Error ? e.message : '사진을 올리지 못했습니다.')
      } finally {
        setUploading((n) => n - 1)
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
                  <button type="button" onClick={() => onInsertImage(img)} className="flex-1 rounded bg-ink py-1.5 text-[12px] font-semibold text-white hover:opacity-90">
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-line pt-5">
        <h3 className="mb-2.5 flex items-center gap-1.5 text-[14px] font-bold"><VideoIcon /> 영상</h3>
        <div className="flex gap-1.5">
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
