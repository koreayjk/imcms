'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  src: string | null
  alt: string
  ratio?: string
  className?: string
}

// 칸 비율과 사진 비율이 다르면(세로 포스터, 긴 가로 사진 등) 잘라내지 않고 통째로 보여 준다
//   남는 자리는 같은 사진을 흐리게 깔아 채운다. 비율이 비슷하면 지금처럼 칸을 꽉 채운다
function needsFit(img: HTMLImageElement, ratio: string) {
  const [w, h] = ratio.split('/').map((n) => Number(n.trim()))
  if (!img.naturalWidth || !img.naturalHeight || !w || !h) return false
  const box = w / h
  const pic = img.naturalWidth / img.naturalHeight
  // 12% 넘게 다르면 통째로 (보도자료 사진은 글자가 들어 있는 경우가 많아 조금만 잘려도 티가 난다)
  return pic < box * 0.88 || pic > box * 1.12
}

export default function Thumb({ src, alt, ratio = '16 / 10', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const [fit, setFit] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // 화면이 준비되기 전에 이미 실패하거나 다 읽힌 사진은 onError·onLoad가 불리지 않으므로 직접 확인한다
  useEffect(() => {
    const img = imgRef.current
    if (!img?.complete) return
    if (img.naturalWidth === 0) setFailed(true)
    else setFit(needsFit(img, ratio))
  }, [src, ratio])

  return (
    <div className={`relative overflow-hidden bg-soft ${className}`} style={{ aspectRatio: ratio }}>
      {src && !failed ? (
        <>
          {fit && <img src={src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl" />}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            onLoad={(e) => setFit(needsFit(e.currentTarget, ratio))}
            className={`absolute inset-0 h-full w-full text-transparent transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none ${fit ? 'object-contain' : 'object-cover'}`}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-6 rounded-full border-2 border-rule" />
        </div>
      )}
    </div>
  )
}
