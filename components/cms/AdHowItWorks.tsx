'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'im_ad_howto_closed'

// 광고 화면 위 안내: 기본 배너(배너 탭)와 계약 광고(광고 계약 탭)가 어떻게 번갈아 나가는지
export default function AdHowItWorks({ current }: { current: 'banners' | 'contracts' }) {
  const [open, setOpen] = useState(true)
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === '1') setOpen(false) } catch { /* 없음 */ }
  }, [])
  const toggle = (v: boolean) => {
    setOpen(v)
    try { localStorage.setItem(KEY, v ? '0' : '1') } catch { /* 없음 */ }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => toggle(true)} className="mb-4 text-[12.5px] font-semibold text-review underline underline-offset-2">
        ⓘ 기본 배너와 계약 광고는 어떻게 나가나요?
      </button>
    )
  }

  return (
    <section className="mb-5 rounded-lg border border-review/30 bg-review/5 p-4 md:p-5" aria-label="광고가 나가는 방식">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[14.5px] font-bold">광고는 이렇게 나갑니다</h2>
        <button type="button" onClick={() => toggle(false)} className="shrink-0 text-[12px] text-muted hover:text-ink">접기 ✕</button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className={`rounded-md border bg-white p-3.5 ${current === 'banners' ? 'border-ink' : 'border-line'}`}>
          <p className="text-[13.5px] font-bold">① 기본 배너 <span className="font-normal text-muted">· 배너 탭에서 올림</span></p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[#3B4048]">
            <li>기간을 <strong>비워 두면 계속</strong> 나갑니다 (고정)</li>
            <li>기간을 정하면 그 기간에만 나갑니다</li>
            <li>우리 매체 홍보·행사 안내, 상시 광고주 배너에 씁니다</li>
          </ul>
          {current !== 'banners' && <Link href="/admin/ads" className="mt-2 inline-block text-[12.5px] font-semibold text-review hover:underline">배너 탭으로 →</Link>}
        </div>
        <div className={`rounded-md border bg-white p-3.5 ${current === 'contracts' ? 'border-ink' : 'border-line'}`}>
          <p className="text-[13.5px] font-bold">② 계약 광고 <span className="font-normal text-muted">· 광고 계약 탭에서 예약</span></p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] leading-relaxed text-[#3B4048]">
            <li><strong>계약 기간에만</strong> 나갑니다 (시작일 0시 ~ 끝나는 날 밤)</li>
            <li>그동안 같은 자리의 <strong>기본 배너를 대신</strong>합니다</li>
            <li>달력에서 빈 날만 고를 수 있어 예약이 겹치지 않습니다</li>
          </ul>
          {current !== 'contracts' && <Link href="/admin/ads/contracts" className="mt-2 inline-block text-[12.5px] font-semibold text-review hover:underline">광고 계약 탭으로 →</Link>}
        </div>
      </div>

      {/* 한 자리의 한 달을 예로 */}
      <div className="mt-3 rounded-md border border-line bg-white p-3.5">
        <p className="text-[12.5px] font-semibold text-muted">예) 상단 띠 자리의 한 달</p>
        <div className="mt-2 flex h-8 overflow-hidden rounded text-[12px] font-semibold">
          <span className="flex basis-[30%] items-center justify-center whitespace-nowrap bg-line/80 text-ink">기본 배너</span>
          <span className="flex basis-[40%] items-center justify-center whitespace-nowrap bg-ink text-white">계약 광고<span className="hidden sm:inline">&nbsp;(10일~21일)</span></span>
          <span className="flex basis-[30%] items-center justify-center whitespace-nowrap bg-line/80 text-ink">기본 배너</span>
        </div>
        <ul className="mt-2.5 space-y-0.5 text-[12.5px] leading-relaxed text-[#3B4048]">
          <li>· <strong>상단 띠·홈 중간·기사 아래·팝업</strong>: 계약 광고가 있으면 그것만, 끝나면 기본 배너가 다시 나옵니다. 기본 배너가 여러 개면 방문할 때마다 번갈아 나옵니다.</li>
          <li>· <strong>오른쪽</strong>(3칸): 계약 광고가 먼저 자리를 잡고, 남는 칸은 기본 배너로 채웁니다.</li>
          <li>· 바뀌는 시각은 시작일 0시이고, 늦어도 5분 안에 홈페이지에 반영됩니다.</li>
        </ul>
      </div>
    </section>
  )
}
