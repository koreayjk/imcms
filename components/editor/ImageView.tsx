'use client'

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useRef, useState } from 'react'
import type { ImageAlign } from './extensions'

const SIZES = ['25%', '50%', '75%', '100%']
const ALIGNS: { key: ImageAlign; label: string }[] = [
  { key: 'left', label: '왼쪽' },
  { key: 'center', label: '가운데' },
  { key: 'right', label: '오른쪽' },
]

// 편집 화면의 사진: 누르면 크기·배치 도구가 뜨고, 오른쪽 아래 모서리를 끌어 크기를 바꾼다
export default function ImageView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [dragWidth, setDragWidth] = useState<string | null>(null)
  const width = (node.attrs.width as string | null) ?? '100%'
  const align = (node.attrs.align as ImageAlign) ?? 'center'
  const shown = dragWidth ?? width

  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    const img = imgRef.current
    const box = img?.closest('.ProseMirror') as HTMLElement | null
    if (!img || !box) return
    const startX = e.clientX
    const startW = img.getBoundingClientRect().width
    const full = box.clientWidth - 48
    let last = shown
    const move = (ev: PointerEvent) => {
      const px = Math.max(80, Math.min(full, startW + (align === 'right' ? startX - ev.clientX : ev.clientX - startX) * (align === 'center' ? 2 : 1)))
      last = `${Math.round((px / full) * 100)}%`
      setDragWidth(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragWidth(null)
      updateAttributes({ width: last === '100%' ? null : last })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const wrapStyle: React.CSSProperties =
    align === 'left' ? { float: 'left', margin: '0.3em 1.25em 0.6em 0', width: shown }
    : align === 'right' ? { float: 'right', margin: '0.3em 0 0.6em 1.25em', width: shown }
    : { margin: '0 auto', width: shown }

  return (
    <NodeViewWrapper className="relative" data-drag-handle="" style={{ clear: align === 'center' ? 'both' : undefined }}>
      <div className="relative" style={wrapStyle}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt ?? ''}
          className={`block h-auto w-full rounded-sm ${selected ? 'outline outline-[3px] outline-[#3D7BE0]' : ''}`}
          draggable={false}
        />
        {selected && editor.isEditable && (
          <>
            <span
              onPointerDown={startResize}
              className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[#3D7BE0] shadow"
              aria-hidden
            />
            <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">{shown}</span>
            <div
              className="absolute -top-11 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-lg bg-[#1C1F26] p-1 text-[12px] text-white shadow-lg"
              onMouseDown={(e) => e.preventDefault()}
            >
              {SIZES.map((s) => (
                <button key={s} type="button" onClick={() => updateAttributes({ width: s === '100%' ? null : s })} className={`rounded px-2 py-1 ${width === s ? 'bg-[#F2B544] text-[#1C1F26]' : 'hover:bg-white/15'}`}>
                  {s}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/25" />
              {ALIGNS.map((a) => (
                <button key={a.key} type="button" onClick={() => updateAttributes({ align: a.key })} className={`rounded px-2 py-1 ${align === a.key ? 'bg-[#F2B544] text-[#1C1F26]' : 'hover:bg-white/15'}`}>
                  {a.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-white/25" />
              <button
                type="button"
                onClick={() => {
                  const alt = window.prompt('사진 설명(대체 텍스트)을 입력하세요', node.attrs.alt ?? '')
                  if (alt !== null) updateAttributes({ alt })
                }}
                className="rounded px-2 py-1 hover:bg-white/15"
              >
                설명
              </button>
              <button type="button" onClick={deleteNode} className="rounded px-2 py-1 text-[#FF8A80] hover:bg-white/15">삭제</button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  )
}
