'use client'

import { useState } from 'react'

// 운영팀: 청구서 결제 전용 링크 복사 (카톡·문자로 보낼 때)
export default function CopyPayLink({ url }: { url: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex items-center gap-2 rounded border border-line bg-[#F8F9FA] py-1.5 pl-3 pr-1.5">
      <code className="min-w-0 flex-1 truncate text-[12.5px]">{url}</code>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(url) } catch { window.prompt('아래 링크를 복사하세요', url) }
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        }}
        className={`shrink-0 rounded px-3 py-1.5 text-[12.5px] font-semibold ${done ? 'bg-published text-white' : 'bg-ink text-white hover:opacity-90'}`}
      >
        {done ? '복사됨 ✓' : '링크 복사'}
      </button>
    </div>
  )
}
