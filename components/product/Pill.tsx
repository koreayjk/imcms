import Link from 'next/link'
import type { ReactNode } from 'react'

// 가는 선 화살표
export function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

const EASE = 'ease-[cubic-bezier(0.32,0.72,0,1)]'

// 알약 단추: 글자 오른쪽에 화살표가 자기 동그라미 안에 들어앉는다. 올리면 동그라미가 살짝 앞으로, 누르면 눌린다
export function Pill({ href, children, tone = 'navy', size = 'lg', className = '' }: { href: string; children: ReactNode; tone?: 'navy' | 'light' | 'white'; size?: 'md' | 'lg'; className?: string }) {
  const toneCls = tone === 'navy'
    ? 'bg-[#1D3461] text-white shadow-[0_12px_30px_-14px_rgba(29,52,97,0.7)] hover:bg-[#152748]'
    : tone === 'white' ? 'bg-white text-[#0F1115] hover:bg-[#F4F6FA]'
    : 'bg-white text-[#16294D] shadow-[inset_0_0_0_1px_rgba(15,17,21,0.08)] hover:bg-[#F4F6FA]'
  const dot = tone === 'navy' ? 'bg-white/15' : 'bg-[#0F1115]/[0.06]'
  const sz = size === 'lg' ? 'gap-4 py-2 pl-7 pr-2 text-[16px]' : 'gap-3 py-1.5 pl-5 pr-1.5 text-[14.5px]'
  const dotSz = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8'
  const cls = `pn-press group inline-flex items-center justify-between rounded-full font-bold ${sz} ${toneCls} ${className}`
  const inner = (
    <>
      <span>{children}</span>
      <span className={`grid shrink-0 place-items-center rounded-full ${dot} ${dotSz} transition-transform duration-500 ${EASE} group-hover:-translate-y-px group-hover:translate-x-0.5 group-hover:scale-105`}><Arrow /></span>
    </>
  )
  return href.startsWith('#') ? <a href={href} className={cls}>{inner}</a> : <Link href={href} className={cls}>{inner}</Link>
}
