'use client'

import { useEffect, useState } from 'react'
import type { AdBanner } from '@/lib/ads'
import AdBannerView from './AdBannerView'

// 첫 화면 팝업. “오늘 하루 보지 않기”는 이 브라우저에 오늘 날짜를 기억한다
export default function AdPopup({ banner }: { banner: AdBanner }) {
  const key = `im-popup-${banner.id}`
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === new Date().toDateString()) return
    } catch {}
    setOpen(true)
  }, [key])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!open) return null
  const hideToday = () => {
    try { localStorage.setItem(key, new Date().toDateString()) } catch {}
    setOpen(false)
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={`광고: ${banner.name}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
      <div className="w-full max-w-[400px] overflow-hidden bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <AdBannerView banner={banner} />
        <div className="flex border-t border-rule text-[13px]">
          <button type="button" onClick={hideToday} className="flex-1 px-3 py-2.5 text-left text-sub hover:text-body">오늘 하루 보지 않기</button>
          <button type="button" onClick={() => setOpen(false)} className="border-l border-rule px-4 py-2.5 font-semibold hover:bg-soft" autoFocus>닫기</button>
        </div>
      </div>
    </div>
  )
}
