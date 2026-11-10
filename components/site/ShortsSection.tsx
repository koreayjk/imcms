'use client'

import { useEffect, useState } from 'react'

// 홈페이지 "쇼츠" 구역: 유튜브 쇼츠를 세로 카드로 보여 주고, 누르면 홈페이지 안에서 재생 창이 뜬다 (유튜브 공식 재생기, 쿠키 없는 주소)
//   홈 안 재생기는 로그인 상태가 아니라 재생기 안의 좋아요·공유는 동작하지 않는다 → 재생 창 아래에 "유튜브에서 열기" 링크를 둔다
export type ShortCard = { id: string; title: string; date?: string }

// bare: 이미 폭·좌우 여백이 있는 칸 안에 넣을 때 (바깥 여백을 붙이지 않는다)
export default function ShortsSection({ title, items, channelUrl, siteName, en, bare = false }: { title: string; items: ShortCard[]; channelUrl?: string; siteName?: string; en?: boolean; bare?: boolean }) {
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
    <section aria-labelledby="shorts-title" className={bare ? 'mt-8 lg:mt-2' : 'mx-auto mb-9 max-w-[1200px] px-4'}>
      <div className="overflow-hidden rounded-2xl border border-[#E3E7EE] bg-gradient-to-b from-[#F7F9FC] to-[#EDF1F7] px-4 pb-6 pt-6 shadow-[0_8px_26px_rgba(30,50,90,0.08)] sm:px-7 sm:pb-7">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-11 place-items-center rounded-[9px] bg-[#FF0000] shadow-[0_4px_12px_rgba(255,0,0,0.25)]">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13l11-6.5z" fill="#fff" /></svg>
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#E0352B]">{siteName ? `${siteName} · Shorts` : 'Shorts'}</p>
              <h2 id="shorts-title" className="text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-body">{title}</h2>
            </div>
          </div>
          {channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 rounded-full border border-[#C9D0DC] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-body transition-colors hover:border-body hover:bg-body hover:text-white">
              {en ? 'YouTube channel' : '유튜브 채널'} ↗
            </a>
          )}
        </div>

        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {items.map((s) => (
            <li key={s.id} className="w-[44vw] max-w-[190px] flex-shrink-0 snap-start lg:w-auto lg:max-w-none">
              <button
                type="button"
                onClick={() => setOpen(s)}
                aria-label={`${s.title} — ${en ? 'play' : '재생'}`}
                className="group relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-black text-left shadow-[0_4px_14px_rgba(20,30,50,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(20,30,50,0.3)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${s.id}/oardefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
                <span aria-hidden className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">Shorts</span>
                <span aria-hidden className="absolute left-1/2 top-[44%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/20 opacity-80 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-white/35 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 6v12l10-6z" fill="#fff" /></svg>
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3">
                  {s.date && <span className="mb-1 block text-[11px] font-medium tabular-nums text-white/65">{s.date}</span>}
                  <span className="line-clamp-3 block text-[13.5px] font-bold leading-[1.38] tracking-[-0.01em] text-white">{s.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={open.title}>
          <button type="button" aria-label={en ? 'Close' : '닫기'} onClick={() => setOpen(null)} className="absolute inset-0 bg-black/80" />
          <div className="relative w-[min(92vw,calc((100dvh-9rem)*9/16))]">
            <button type="button" onClick={() => setOpen(null)} className="absolute -top-10 right-0 text-[14px] font-semibold text-white">{en ? 'Close' : '닫기'} ✕</button>
            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${open.id}?autoplay=1&rel=0&playsinline=1`}
                title={open.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <div className="mt-2.5 flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-[13px] leading-snug text-white/90">{open.title}</p>
              <a href={`https://www.youtube.com/shorts/${open.id}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 rounded-full border border-white/30 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white hover:text-black">
                {en ? 'Open on YouTube' : '유튜브에서 열기'} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
