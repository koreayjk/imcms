'use client'

import { useLinkStatus } from 'next/link'

// 메뉴를 누른 순간 바로 표시 (화면을 받아 오는 동안). Link 안에 넣는다. 늘 자리를 차지하고 투명도만 바꿔 화면이 흔들리지 않는다
export default function LinkPending({ className }: { className: string }) {
  const { pending } = useLinkStatus()
  return <span aria-hidden className={`pointer-events-none absolute transition-opacity duration-150 ${pending ? 'animate-pulse opacity-100' : 'opacity-0'} ${className}`} />
}
