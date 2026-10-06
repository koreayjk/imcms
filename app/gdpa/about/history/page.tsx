import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '연혁' }

// 연혁 (일이 생기면 위에 추가한다)
const HISTORY: { year: string; items: [string, string][] }[] = [
  { year: '2026', items: [
    ['10월', '글로벌디지털언론협회(GDPA) 설립 추진, 협회 홈페이지 개설'],
    ['10월', '회원사 참여: 더케어타임즈, Shipping Times, Israel Today'],
  ] },
]

export default async function History() {
  return (
    <SubPage base={(await gdpaBase())} section="/about" current="/about/history" title="연혁">
      {HISTORY.map((h) => (
        <section key={h.year} className="grid gap-4 border-t-2 border-[var(--g-navy)] pt-6 md:grid-cols-[160px_1fr]">
          <p className="text-[34px] font-extrabold text-[var(--g-navy)]">{h.year}</p>
          <ul className="space-y-3">
            {h.items.map(([m, t], i) => (
              <li key={i} className="flex gap-5 border-b border-[var(--g-line)] pb-3 text-[16px]">
                <span className="w-12 shrink-0 font-bold text-[var(--g-gold-ink)]">{m}</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </SubPage>
  )
}
