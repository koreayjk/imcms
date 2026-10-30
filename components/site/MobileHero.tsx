'use client'

import { Children, useEffect, useRef, useState, type ReactNode } from 'react'

// 휴대폰 홈 톱 기사: 화면 폭을 꽉 채운 큰 사진이 아래에서 흰색으로 풀리며 그 위에 큰 제목이 얹히고, 맨 위에는 TOP NEWS 표지, 맨 아래에는 기사 수만큼 나뉜 진행 막대가 있다.
//   기사가 2개 이상이면 정한 간격(초)마다 부드럽게 겹쳐 바뀌고(사진은 천천히 확대), 좌우로 밀어서도 넘길 수 있다.
//   손가락을 대고 있는 동안·다른 탭을 보는 동안은 멈추고, 움직임 줄이기 설정이면 확대 없이 바로 바뀐다
export default function MobileHero({ seconds, children, label, badge = 'TOP NEWS', brand = '#1F3A5F' }: { seconds: number; children: ReactNode; label: string; badge?: string; brand?: string }) {
  const slides = Children.toArray(children)
  const n = slides.length
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const [hidden, setHidden] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const ms = Math.max(2, Math.min(30, seconds)) * 1000
  const paused = hold || hidden

  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  useEffect(() => {
    if (n < 2 || paused) return
    const id = window.setTimeout(() => setI((x) => (x + 1) % n), ms)
    return () => window.clearTimeout(id)
  }, [i, n, ms, paused])

  const go = (k: number) => setI(((k % n) + n) % n)

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="mhero relative"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={(e) => { setHold(true); start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={(e) => {
        const s = start.current
        start.current = null
        setHold(false)
        if (!s || n < 2) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(i + (dx < 0 ? 1 : -1))
      }}
      onTouchCancel={() => { start.current = null; setHold(false) }}
    >
      <style>{`
        .mhero .mh-slide{opacity:0;visibility:hidden;transition:opacity 900ms cubic-bezier(.4,0,.2,1),visibility 0s linear 900ms}
        .mhero .mh-slide[data-on="true"]{opacity:1;visibility:visible;transition:opacity 900ms cubic-bezier(.4,0,.2,1),visibility 0s}
        .mhero .mh-slide[data-on="true"] .hs-photo>*{animation:mh-zoom var(--mh-ms) ease-out both}
        .mhero .mh-slide[data-on="true"] .hs-text{animation:mh-rise 800ms cubic-bezier(.2,.7,.2,1) 200ms both}
        .mhero [data-paused="true"] .hs-photo>*{animation-play-state:paused}
        @keyframes mh-zoom{from{transform:scale(1)}to{transform:scale(1.06)}}
        @keyframes mh-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes mh-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media (prefers-reduced-motion:reduce){
          .mhero .mh-slide,.mhero .mh-slide[data-on="true"]{transition:none}
          .mhero .mh-slide[data-on="true"] .hs-photo>*,.mhero .mh-slide[data-on="true"] .hs-text{animation:none}
        }
      `}</style>
      <div className="grid" data-paused={paused} style={{ ['--mh-ms' as string]: `${ms + 900}ms` }}>
        {slides.map((s, k) => (
          <div key={k} className="mh-slide col-start-1 row-start-1" data-on={k === i} aria-hidden={k !== i} inert={k !== i} aria-roledescription="slide" aria-label={`${k + 1} / ${n}`}>
            {s}
          </div>
        ))}
      </div>
      <span
        className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 px-5 pb-3.5 pt-2 text-[17px] font-extrabold tracking-[-0.01em] text-white"
        style={{ background: brand, clipPath: 'polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%)' }}
      >
        {badge}
      </span>
      {n > 1 && (
        <div className="flex gap-0.5 bg-[#E3E5E8]" data-paused={paused}>
          {slides.map((_, k) => (
            <button key={k} type="button" onClick={() => go(k)} aria-label={`${k + 1}번째 기사`} aria-current={k === i} className="relative block h-[10px] flex-1 overflow-hidden">
              {k < i && <span className="absolute inset-0" style={{ background: brand, opacity: 0.4 }} />}
              {k === i && (
                <span
                  key={`${i}-${ms}`}
                  className="absolute inset-0 origin-left"
                  style={{ background: brand, animation: `mh-bar ${ms}ms linear both`, animationPlayState: paused ? 'paused' : 'running' }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
