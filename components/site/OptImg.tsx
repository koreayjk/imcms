'use client'

import { useState } from 'react'
import { canOptimize, optimizedSrc, optimizedSrcSet } from '@/lib/image-url'

// 사진 한 장을 화면 크기에 맞게 줄여 보여준다. 줄인 사진을 못 받으면 원본으로 바꾼다
export default function OptImg({ src, alt, sizes = '(max-width: 768px) 100vw, 760px', className }: { src: string; alt: string; sizes?: string; className?: string }) {
  const [original, setOriginal] = useState(false)
  if (original || !canOptimize(src)) return <img src={src} alt={alt} className={className} />
  return <img src={optimizedSrc(src, 1200)} srcSet={optimizedSrcSet(src)} sizes={sizes} alt={alt} className={className} onError={() => setOriginal(true)} />
}
