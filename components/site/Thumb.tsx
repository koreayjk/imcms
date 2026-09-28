'use client'

import { useState } from 'react'

type Props = {
  src: string | null
  alt: string
  ratio?: string
  className?: string
}

export default function Thumb({ src, alt, ratio = '16 / 10', className = '' }: Props) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`relative overflow-hidden bg-soft ${className}`} style={{ aspectRatio: ratio }}>
      {src && !failed ? (
        <img
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
