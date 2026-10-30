'use client'

import { Children, useEffect, useRef, useState, type ReactNode } from 'react'

// 홈 톱 헤드라인: 편집장이 정한 1~10개 기사를 차례로 넘긴다 (홈 편집판에서 개수·간격을 정한다)
//   · 기사 칸(children)은 서버가 그려 주고, 여기서는 넘기기만 한다. 첫 장면은 서버에서 이미 보이므로 스크립트 전에도 기사 하나는 읽힌다
//   · 부드럽게 겹쳐 바뀌고(약 1초), 사진은 천천히 확대되며, 글은 아래에서 살짝 올라온다. 아래 막대가 다음 기사까지의 시간을 보여 준다
//   · 마우스를 올리거나 키보드로 들어오면 멈춘다. 탭이 가려지면 멈춘다. 움직임 줄이기 설정이면 확대·올라옴 없이 바로 바뀐다
export default function HeroSlider({ seconds, children, label, brand = '#1F3A5F' }: { seconds: number; children: ReactNode; label: string; brand?: string }) {
  const slides = Children.toArray(children)
  const n = slides.length
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const [hidden, setHidden] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const ms = Math.max(2, Math.min(30, seconds)) * 1000
  const paused = hold || hidden

  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  // 한 장면이 끝나면 다음으로 (멈춘 동안은 시계도 멈추고, 풀리면 그 장면을 처음부터 다시 센다)
  useEffect(() => {
    if (n < 2 || paused) return
    const id = window.setTimeout(() => setI((x) => (x + 1) % n), ms)
    return () => window.clearTimeout(id)
  }, [i, n, ms, paused])

  if (n < 2) return <>{children}</>

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="hero-slider relative"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocusCapture={() => setHold(true)}
      onBlurCapture={(e) => { if (!root.current?.contains(e.relatedTarget as Node | null)) setHold(false) }}
    >
      <style>{`
        .hero-slider .hs-slide{opacity:0;visibility:hidden;transition:opacity 1100ms cubic-bezier(.4,0,.2,1),visibility 0s linear 1100ms}
        .hero-slider .hs-slide[data-on="true"]{opacity:1;visibility:visible;transition:opacity 1100ms cubic-bezier(.4,0,.2,1),visibility 0s}
        .hero-slider .hs-slide[data-on="true"] .hs-photo>*{animation:hs-zoom var(--hs-ms) ease-out both}
        .hero-slider .hs-slide[data-on="true"] .hs-text{animation:hs-rise 900ms cubic-bezier(.2,.7,.2,1) 250ms both}
        .hero-slider [data-paused="true"] .hs-photo>*{animation-play-state:paused}
        @keyframes hs-zoom{from{transform:scale(1)}to{transform:scale(1.07)}}
        @keyframes hs-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes hs-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media (prefers-reduced-motion:reduce){
          .hero-slider .hs-slide,.hero-slider .hs-slide[data-on="true"]{transition:none}
          .hero-slider .hs-slide[data-on="true"] .hs-photo>*,.hero-slider .hs-slide[data-on="true"] .hs-text{animation:none}
        }
      `}</style>
      <div className="grid" style={{ ['--hs-ms' as string]: `${ms + 1100}ms` }} data-paused={paused}>
        {slides.map((s, k) => (
          <div key={k} className="hs-slide col-start-1 row-start-1" data-on={k === i} aria-hidden={k !== i} inert={k !== i} aria-roledescription="slide" aria-label={`${k + 1} / ${n}`}>
            {s}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3" data-paused={paused}>
        <button type="button" onClick={() => setI((i - 1 + n) % n)} aria-label="이전 기사" className="grid h-7 w-7 place-items-center rounded-full border border-rule text-[13px] text-sub hover:border-body hover:text-body">‹</button>
        <ol className="flex items-center gap-2">
          {slides.map((_, k) => (
            <li key={k}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={`${k + 1}번째 기사`}
                aria-current={k === i}
                className="relative block h-[3px] w-9 overflow-hidden rounded-full bg-rule"
              >
                {k < i && <span className="absolute inset-0" style={{ background: brand, opacity: 0.35 }} />}
                {k === i && (
                  <span
                    key={`${i}-${ms}`}
                    className="absolute inset-0 origin-left"
                    style={{ background: brand, animation: `hs-bar ${ms}ms linear both`, animationPlayState: paused ? 'paused' : 'running' }}
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setI((i + 1) % n)} aria-label="다음 기사" className="grid h-7 w-7 place-items-center rounded-full border border-rule text-[13px] text-sub hover:border-body hover:text-body">›</button>
      </div>
    </div>
  )
}
