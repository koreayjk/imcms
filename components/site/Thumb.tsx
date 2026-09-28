'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  src: string | null
  alt: string
  ratio?: string
  className?: string
}

export default function Thumb({ src, alt, ratio = '16 / 10', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // 화면이 준비되기 전에 이미 실패한 사진은 onError가 불리지 않으므로 직접 확인한다
  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth === 0) setFailed(true)
  }, [src])

  return (
    <div className={`relative overflow-hidden bg-soft ${className}`} style={{ aspectRatio: ratio }}>
      {src && !failed ? (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover text-transparent transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-6 w-6 rounded-full border-2 border-rule" />
        </div>
      )}
    </div>
  )
}
