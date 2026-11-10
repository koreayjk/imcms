'use client'

import { useEffect, useRef, useState } from 'react'

// 홈페이지 "쇼츠" 구역: 유튜브 쇼츠를 세로 카드로 보여 주고, 누르면 홈페이지 안에서 재생 창이 뜬다 (유튜브 공식 재생기, 쿠키 없는 주소)
//   홈 안 재생기는 로그인 상태가 아니라 재생기 안의 좋아요·공유는 동작하지 않는다 → 재생 창 아래에 "유튜브에서 열기" 링크를 둔다
export type ShortCard = { id: string; title: string; date?: string }

// bare: 이미 폭·좌우 여백이 있는 칸 안에 넣을 때 (바깥 여백을 붙이지 않는다)
export default function ShortsSection({ title, items, channelUrl, siteName, en, bare = false }: { title: string; items: ShortCard[]; channelUrl?: string; siteName?: string; en?: boolean; bare?: boolean }) {
  // 열려 있는 쇼츠의 순서 (null = 닫힘). 좌우 화살표로 앞뒤 쇼츠를 이어서 본다
  const [idx, setIdx] = useState<number | null>(null)
  const open = idx === null ? null : items[idx] ?? null
  const total = items.length
  const go = (d: number) => setIdx((i) => (i === null ? i : Math.min(total - 1, Math.max(0, i + d))))

  // 카드 줄: 한 화면(PC는 6개)씩 좌우 화살표로 넘긴다
  const row = useRef<HTMLUListElement>(null)
  const [edge, setEdge] = useState({ l: false, r: false })
  const measure = () => {
    const el = row.current
    if (!el) return
    setEdge({ l: el.scrollLeft > 8, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 })
  }
  useEffect(() => {
    measure()
    const el = row.current
    window.addEventListener('resize', measure)
    el?.addEventListener('scroll', measure, { passive: true })
    return () => { window.removeEventListener('resize', measure); el?.removeEventListener('scroll', measure) }
  }, [items.length])
  const slide = (dir: number) => {
    const el = row.current
    if (el) el.scrollBy({ left: dir * (el.clientWidth + 16), behavior: 'smooth' })
  }

  // 한 편이 끝나면 자동으로 다음 쇼츠로 (유튜브 재생기가 보내 주는 상태 신호를 받는다. 쇼츠는 끝나면 처음부터 다시 도는 경우가 있어, 재생 위치가 되감기는 것도 "끝남"으로 본다)
  const [auto, setAuto] = useState(true)
  const frame = useRef<HTMLIFrameElement>(null)
  const track = useRef({ t: 0, d: 0, done: false })
  const YT = 'https://www.youtube-nocookie.com'
  const listen = () => {
    const w = frame.current?.contentWindow
    if (!w) return
    const post = (m: object) => { try { w.postMessage(JSON.stringify(m), YT) } catch { /* 무시 */ } }
    post({ event: 'listening', id: 1, channel: 'widget' })
    post({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' })
  }
  const onFrameLoad = () => {
    track.current = { t: 0, d: 0, done: false }
    listen()
    // 재생기가 준비되는 시간이 영상마다 달라서 몇 번 더 알린다
    window.setTimeout(listen, 700)
    window.setTimeout(listen, 2000)
  }
  useEffect(() => {
    if (idx === null || !auto) return
    const advance = () => {
      if (track.current.done) return
      track.current.done = true
      setIdx((i) => (i !== null && i < total - 1 ? i + 1 : i))
    }
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== YT && e.origin !== 'https://www.youtube.com') return
      if (e.source !== frame.current?.contentWindow) return
      let d: { event?: string; info?: unknown } | null = null
      try { d = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data as typeof d) } catch { return }
      if (!d || typeof d !== 'object') return
      const info = d.info as { playerState?: number; currentTime?: number; duration?: number } | number | undefined
      if (d.event === 'onStateChange' && info === 0) return advance()
      if (d.event === 'infoDelivery' && info && typeof info === 'object') {
        if (info.playerState === 0) return advance()
        if (typeof info.currentTime === 'number') {
          const dur = Number(info.duration) || track.current.d
          if (dur) track.current.d = dur
          const prev = track.current.t
          track.current.t = info.currentTime
          if (prev > 1 && info.currentTime < prev - 1 && prev >= (track.current.d || Infinity) - 2) advance()
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [idx, auto, total])

  useEffect(() => {
    if (idx === null) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null)
      else if (e.key === 'ArrowRight') setIdx((i) => (i === null ? i : Math.min(total - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setIdx((i) => (i === null ? i : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [idx, total])

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

        <div className="relative">
        <ul ref={row} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:gap-4 lg:px-0 [&::-webkit-scrollbar]:hidden">
          {items.map((s) => (
            <li key={s.id} className="w-[44vw] max-w-[190px] flex-shrink-0 snap-start lg:w-[calc((100%-5rem)/6)] lg:max-w-none">
              <button
                type="button"
                onClick={() => setIdx(items.indexOf(s))}
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
        {edge.l && (
          <button type="button" onClick={() => slide(-1)} aria-label={en ? 'Previous shorts' : '이전 쇼츠'} className="absolute -left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[22px] font-bold text-body shadow-[0_6px_18px_rgba(20,30,50,0.28)] hover:bg-body hover:text-white lg:grid">‹</button>
        )}
        {edge.r && (
          <button type="button" onClick={() => slide(1)} aria-label={en ? 'More shorts' : '다음 쇼츠 보기'} className="absolute -right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-[22px] font-bold text-body shadow-[0_6px_18px_rgba(20,30,50,0.28)] hover:bg-body hover:text-white lg:grid">›</button>
        )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={open.title}>
          <button type="button" aria-label={en ? 'Close' : '닫기'} onClick={() => setIdx(null)} className="absolute inset-0 bg-black/80" />
          <div className="relative w-[min(92vw,calc((100dvh-9rem)*9/16))]">
            <button type="button" onClick={() => setIdx(null)} className="absolute -top-10 right-0 text-[14px] font-semibold text-white">{en ? 'Close' : '닫기'} ✕</button>
            <div className="relative">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-xl bg-black shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                <iframe
                  key={open.id}
                  ref={frame}
                  onLoad={onFrameLoad}
                  src={`${YT}/embed/${open.id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(typeof window === 'undefined' ? '' : window.location.origin)}`}
                  title={open.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="h-full w-full"
                />
              </div>
              {/* 넓은 화면: 재생 창 양옆의 화살표 */}
              {idx! > 0 && (
                <button type="button" onClick={() => go(-1)} aria-label={en ? 'Previous short' : '이전 쇼츠'} className="absolute -left-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[20px] font-bold text-black shadow-lg hover:bg-white sm:grid">‹</button>
              )}
              {idx! < total - 1 && (
                <button type="button" onClick={() => go(1)} aria-label={en ? 'Next short' : '다음 쇼츠'} className="absolute -right-14 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[20px] font-bold text-black shadow-lg hover:bg-white sm:grid">›</button>
              )}
            </div>
            <div className="mt-2.5 flex items-start justify-between gap-3">
              <p className="line-clamp-2 text-[13px] leading-snug text-white/90">{open.title}</p>
              <a href={`https://www.youtube.com/shorts/${open.id}`} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 rounded-full border border-white/30 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white hover:text-black">
                {en ? 'Open on YouTube' : '유튜브에서 열기'} ↗
              </a>
            </div>
            {/* 아래 줄: 이전 · 몇 번째 · 다음 (휴대폰에서도 쓰는 버튼) */}
            <div className="mt-3 flex items-center justify-center gap-4 text-white">
              <button type="button" onClick={() => go(-1)} disabled={idx === 0} className="rounded-full border border-white/35 px-4 py-1.5 text-[13px] font-semibold disabled:opacity-30">{en ? '‹ Prev' : '‹ 이전'}</button>
              <span className="text-[12.5px] tabular-nums text-white/75">{(idx ?? 0) + 1} / {total}</span>
              <button type="button" onClick={() => go(1)} disabled={idx === total - 1} className="rounded-full border border-white/35 px-4 py-1.5 text-[13px] font-semibold disabled:opacity-30">{en ? 'Next ›' : '다음 ›'}</button>
            </div>
            <label className="mt-2.5 flex cursor-pointer items-center justify-center gap-2 text-[12.5px] text-white/80">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {en ? 'Auto-play the next short' : '끝나면 자동으로 다음 쇼츠'}
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
