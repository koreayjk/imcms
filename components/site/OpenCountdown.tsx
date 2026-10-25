'use client'

import { useEffect, useState } from 'react'

// 오픈 준비 중 안내 화면의 카운트다운: 오픈 시각(절대 시각)까지 남은 시간을 보여 주고, 시각이 되면 화면을 새로 불러 홈페이지로 넘어간다
export default function OpenCountdown({ openAt, en = false }: { openAt: string; en?: boolean }) {
  const target = Date.parse(openAt)
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const left = now === null ? null : target - now
  // 시각이 되면 새로 불러온다 (서버가 같은 시각에 열린 매체로 돌려준다). 혹시 아직 안 열렸으면 몇 초 뒤 다시
  useEffect(() => {
    if (left === null || left > 0) return
    const id = window.setTimeout(() => window.location.reload(), 1500)
    return () => window.clearTimeout(id)
  }, [left === null ? null : left > 0 ? 1 : Math.floor(-left / 5000)])

  if (left === null) return <div className="mt-6 h-[78px]" aria-hidden />
  const s = Math.max(0, Math.floor(left / 1000))
  const parts: [number, string][] = [[Math.floor(s / 86400), en ? 'days' : '일'], [Math.floor((s % 86400) / 3600), en ? 'hours' : '시간'], [Math.floor((s % 3600) / 60), en ? 'min' : '분'], [s % 60, en ? 'sec' : '초']]
  return (
    <div className="mt-6" role="timer" aria-label={en ? 'Time until opening' : '오픈까지 남은 시간'}>
      {left <= 0 ? (
        <p className="text-[15px] font-bold text-[color:var(--brand)]">{en ? 'Opening now…' : '지금 오픈합니다…'}</p>
      ) : (
        <div className="flex items-start justify-center gap-2.5">
          {parts.map(([n, label], i) => (
            <div key={label} className="flex items-start gap-2.5">
              <div className="min-w-[64px] rounded-xl bg-[color:var(--brand)] px-2 py-2.5 text-white">
                <div className="text-[30px] font-extrabold leading-none tabular-nums">{String(n).padStart(2, '0')}</div>
                <div className="mt-1 text-[11.5px] font-semibold opacity-80">{label}</div>
              </div>
              {i < parts.length - 1 && <span className="pt-2.5 text-[24px] font-bold text-[#9AA0A8]" aria-hidden>:</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
