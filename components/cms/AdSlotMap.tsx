'use client'

import type { ReactNode } from 'react'
import { AD_SLOTS, type AdSlotId } from '@/lib/ads'

// 광고 자리 지도: 홈페이지를 단순하게 그린 그림 위에 광고 자리를 색으로 표시한다
export const SLOT_COLOR: Record<AdSlotId, string> = {
  header: '#E5483A',
  sidebar: '#2F6BF0',
  home_middle: '#0F9F6E',
  article_bottom: '#D97706',
  popup: '#7C3AED',
}
export const SLOT_NO: Record<AdSlotId, number> = Object.fromEntries(AD_SLOTS.map((s, i) => [s.id, i + 1])) as Record<AdSlotId, number>
const LABEL = Object.fromEntries(AD_SLOTS.map((s) => [s.id, s.label])) as Record<AdSlotId, string>

type Kind = 'home' | 'article' | 'mobile'

// 회색 막대 = 기사·글자 자리
const Bar = ({ w = '100%', h = 6 }: { w?: string; h?: number }) => <span className="block rounded-sm bg-[#DADDE2]" style={{ width: w, height: h }} />
const Box = ({ h, className = '' }: { h: number; className?: string }) => <span className={`block rounded-sm bg-[#E6E8EC] ${className}`} style={{ height: h }} />

function Slot({ id, h, show, small, count, onPick, className = '', children }: {
  id: AdSlotId; h?: number; show: AdSlotId | 'all'; small: boolean; count?: number; onPick?: (id: AdSlotId) => void; className?: string; children?: ReactNode
}) {
  const on = show === 'all' || show === id
  const color = SLOT_COLOR[id]
  const Tag = onPick ? 'button' : 'span'
  return (
    <Tag
      {...(onPick ? { type: 'button' as const, onClick: () => onPick(id), title: `${LABEL[id]} 자리 보기` } : {})}
      className={`relative flex w-full items-center justify-center rounded-[3px] text-center leading-tight transition ${on ? 'border-2 border-dashed' : 'border border-dashed border-[#C9CDD3] bg-transparent'} ${onPick ? 'hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1' : ''} ${className}`}
      style={{ height: h, ...(on ? { borderColor: color, background: `${color}1F`, color, outlineColor: color } : {}) }}
    >
      {on && !small && (
        <span className="px-1 text-[11px] font-bold">
          {SLOT_NO[id]} {LABEL[id]}
          {count != null && <span className="ml-1 font-semibold opacity-80">· {count ? `${count}개` : '비어 있음'}</span>}
        </span>
      )}
      {on && small && <span className="text-[9px] font-extrabold">{SLOT_NO[id]}</span>}
      {children}
    </Tag>
  )
}

// 페이지 하나 그림 (홈 PC · 기사 PC · 휴대폰)
export function PageSketch({ kind, show = 'all', small = false, counts, onPick }: {
  kind: Kind; show?: AdSlotId | 'all'; small?: boolean; counts?: Partial<Record<AdSlotId, number>>; onPick?: (id: AdSlotId) => void
}) {
  const s = (id: AdSlotId, h: number, className = '') => <Slot id={id} h={h} show={show} small={small} count={counts?.[id]} onPick={onPick} className={className} />
  const k = small ? 0.42 : 1 // 작은 그림은 높이를 줄인다
  const H = (n: number) => Math.max(3, Math.round(n * k))
  const mobile = kind === 'mobile'

  return (
    <div className={`relative overflow-hidden rounded-md border border-[#D5D8DD] bg-white ${small ? 'p-1' : 'p-2'}`} aria-hidden={small || undefined}>
      {/* 머리: 로고·메뉴 */}
      <div className={`flex items-center justify-between border-b-2 border-[#1C1F26] ${small ? 'pb-0.5' : 'pb-1.5'}`}>
        <span className="block rounded-sm bg-[#1C1F26]" style={{ width: mobile ? '40%' : '22%', height: H(10) }} />
        {!mobile && <span className="flex w-1/2 justify-end gap-1">{[0, 1, 2, 3, 4].map((i) => <Bar key={i} w="14%" h={H(5)} />)}</span>}
        {mobile && <span className="block rounded-sm bg-[#DADDE2]" style={{ width: 12, height: H(8) }} />}
      </div>
      <div className={small ? 'mt-0.5' : 'mt-1.5'}>{s('header', H(mobile ? 26 : 20))}</div>

      {kind === 'home' && (
        <>
          <div className={`grid grid-cols-[1fr_28%] ${small ? 'mt-1 gap-1' : 'mt-2 gap-2'}`}>
            <div className={small ? 'space-y-0.5' : 'space-y-1.5'}>
              <Box h={H(54)} />
              <div className="grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => <Box key={i} h={H(22)} />)}</div>
            </div>
            <div className={small ? 'space-y-0.5' : 'space-y-1'}>
              <Bar h={H(5)} /><Bar w="80%" h={H(5)} /><Bar w="90%" h={H(5)} />
              {s('sidebar', H(44))}
            </div>
          </div>
          <div className={small ? 'mt-1' : 'mt-2'}>{s('home_middle', H(24))}</div>
          <div className={`grid grid-cols-4 ${small ? 'mt-1 gap-0.5' : 'mt-2 gap-1'}`}>{[0, 1, 2, 3].map((i) => <Box key={i} h={H(20)} />)}</div>
          {/* 팝업: 첫 화면 위에 뜨는 창 */}
          {(show === 'all' || show === 'popup') && (
            <div className="pointer-events-none absolute inset-0 bg-black/[0.04]">
              <div className="pointer-events-auto absolute left-[36%] top-[22%] w-[26%] rounded-[4px] bg-white p-0.5 shadow-lg">
                {s('popup', H(64))}
                {!small && <span className="mt-0.5 block text-center text-[8px] text-[#5B616B]">오늘 하루 보지 않기 · 닫기</span>}
              </div>
            </div>
          )}
        </>
      )}

      {kind === 'article' && (
        <div className={`grid grid-cols-[1fr_28%] ${small ? 'mt-1 gap-1' : 'mt-2 gap-2'}`}>
          <div className={small ? 'space-y-0.5' : 'space-y-1'}>
            <Bar w="85%" h={H(9)} /><Bar w="60%" h={H(5)} />
            <Box h={H(36)} className={small ? '' : 'mt-1'} />
            {[0, 1, 2, 3].map((i) => <Bar key={i} w={i === 3 ? '70%' : '100%'} h={H(4)} />)}
            {s('article_bottom', H(22))}
            <div className="grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((i) => <Box key={i} h={H(14)} />)}</div>
          </div>
          <div className={small ? 'space-y-0.5' : 'space-y-1'}>
            <Bar h={H(5)} /><Bar w="80%" h={H(5)} />
            {s('sidebar', H(44))}
            <Bar w="90%" h={H(5)} /><Bar w="70%" h={H(5)} />
          </div>
        </div>
      )}

      {kind === 'mobile' && (
        <div className={small ? 'mt-1 space-y-0.5' : 'mt-2 space-y-1'}>
          <Bar w="90%" h={H(8)} /><Box h={H(40)} />
          {[0, 1, 2].map((i) => <Bar key={i} w={i === 2 ? '60%' : '100%'} h={H(4)} />)}
          {s('article_bottom', H(24))}
          {/* 휴대폰에서 오른쪽 광고는 본문 아래로 내려온다 */}
          {s('sidebar', H(36))}
          <Bar w="80%" h={H(4)} />
        </div>
      )}

      {/* 꼬리 */}
      <div className={`border-t border-[#E4E6EA] ${small ? 'mt-1 pt-0.5' : 'mt-2 pt-1'}`}><Bar w="40%" h={H(4)} /></div>
    </div>
  )
}

// 광고 관리 화면 맨 위: 세 화면을 나란히 보여 주고, 자리를 누르면 그 자리 목록으로 이동
export default function AdSlotMap({ counts }: { counts: Partial<Record<AdSlotId, number>> }) {
  const pick = (id: AdSlotId) => {
    const el = document.getElementById(`slot-card-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.add('ring-2')
    setTimeout(() => el.classList.remove('ring-2'), 1600)
  }
  return (
    <section aria-labelledby="ad-map-title" className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ad-map-title" className="text-[15px] font-bold">광고 자리 지도</h2>
        <p className="text-[12.5px] text-muted">색칠된 자리를 누르면 그 자리에 건 배너로 이동합니다.</p>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_0.55fr]">
        {([['home', '홈 첫 화면 (PC)'], ['article', '기사 화면 (PC)'], ['mobile', '휴대폰 (기사 화면)']] as const).map(([kind, title]) => (
          <figure key={kind} className={kind === 'mobile' ? 'mx-auto w-full max-w-[220px]' : ''}>
            <PageSketch kind={kind} counts={counts} onPick={pick} />
            <figcaption className="mt-1.5 text-center text-[12px] font-semibold text-muted">{title}</figcaption>
          </figure>
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
        {AD_SLOTS.map((s) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-sm text-[10px] font-bold text-white" style={{ background: SLOT_COLOR[s.id] }}>{SLOT_NO[s.id]}</span>
            <span className="font-semibold">{s.label}</span>
            <span className="text-muted">{counts[s.id] ? `${counts[s.id]}개` : '비어 있음'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// 자리 하나만 보여 주는 작은 그림 (자리마다 어울리는 화면으로)
export function SlotThumb({ id }: { id: AdSlotId }) {
  const kind: Kind = id === 'article_bottom' ? 'article' : 'home'
  return (
    <div className="w-[120px] shrink-0">
      <PageSketch kind={kind} show={id} small />
    </div>
  )
}
