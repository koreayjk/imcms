'use client'

import { useRouter } from 'next/navigation'
import { PAGE_SIZES } from '@/lib/list-size'

// 목록 한 쪽에 몇 건씩 볼지 (이 브라우저에 1년 동안 기억한다 — 다음에 들어와도 그대로)

export default function PageSizeSelect({ cookie, value, href }: { cookie: string; value: number; href: string }) {
  const router = useRouter()
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">한 쪽에 보일 기사 수</span>
      <select
        value={value}
        onChange={(e) => {
          document.cookie = `${cookie}=${e.target.value}; path=/; max-age=31536000; samesite=lax`
          router.push(href)
          router.refresh()
        }}
        className="h-8 rounded border border-line bg-white pl-2 pr-7 text-[12.5px] text-ink"
      >
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}건씩 보기</option>)}
      </select>
    </label>
  )
}
