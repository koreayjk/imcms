'use client'

import { useEffect, useState } from 'react'

// 홈페이지 "쇼츠" 구역: 유튜브 쇼츠를 세로 카드로 보여 주고, 누르면 홈 위에 작은 재생 창이 뜬다 (유튜브 공식 재생기, 쿠키 없는 주소)
export type ShortCard = { id: string; title: string }

export default function ShortsSection({ title, items, channelUrl, en }: { title: string; items: ShortCard[]; channelUrl?: string; en?: boolean }) {
  const [open, setOpen] = useState<ShortCard | null>(null)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!items.length) return null
  return (
    <section aria-labelledby="shorts-title" className="mx-auto mb-9 max-w-[1200px] px-4">
      <div className="border-t-[3px] border-brand pt-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="shorts-title" className="flex items-center gap-2 text-[18px] font-bold tracking-[-0.02em] text-brand">
            <span aria-hidden className="grid h-[18px] w-[26px] place-items-center rounded-[5px] bg-[#FF0000]"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5.5v13l11-6.5z" fill="#fff" /></svg></span>
            {title}
          </h2>
          {channelUrl && <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-sub hover:text-brand">{en ? 'More on YouTube' : '유튜브에서 더 보기'} →</a>}
        </div>
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0">
          {items.map((s) => (
            <li key={s.id} className="w-[140px] flex-shrink-0 snap-start sm:w-[160px] lg:w-auto">
              <button type="button" onClick={() => setOpen(s)} aria-label={`${s.title} ${en ? '(play)' : '재생'}`} className="group relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-[#1A1D1B] text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${s.id}/oardefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
                <span aria-hidden className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55"><svg viewBox="0 0 24 24" width="12" height="12"><path d="M8 5.5v13l11-6.5z" fill="#fff" /></svg></span>
                <span className="absolute inset-x-0 bottom-0 line-clamp-3 p-2.5 text-[13px] font-semibold leading-[1.35] text-white">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={open.title}>
          <button type="button" aria-label={en ? 'Close' : '닫기'} onClick={() => setOpen(null)} className="absolute inset-0 bg-black/75" />
          <div className="relative w-[min(92vw,calc((100dvh-6rem)*9/16))]">
            <button type="button" onClick={() => setOpen(null)} className="absolute -top-10 right-0 text-[14px] font-semibold text-white">{en ? 'Close' : '닫기'} ✕</button>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-lg bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${open.id}?autoplay=1&rel=0&playsinline=1`}
                title={open.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <p className="mt-2 line-clamp-2 text-[13px] text-white/90">{open.title}</p>
          </div>
        </div>
      )}
    </section>
  )
}
