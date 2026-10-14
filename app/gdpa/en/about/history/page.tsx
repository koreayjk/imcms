import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'History' }

// 연혁 영문판 (한국어 app/gdpa/about/history 와 함께 고친다)
const HISTORY: { year: string; items: [string, string][] }[] = [
  { year: '2026', items: [
    ['Oct.', 'Work begins to found the Global Digital Press Association (GDPA); the association website opens'],
    ['Oct.', 'First members join: The Care Times, Shipping Times, Israel Today'],
    ['Oct.', 'New members: EduWide, NextGen Times, The Statecraft Times (6 members)'],
    ['Oct.', 'New member: Chiang Mai Mission Times (7 members)'],
  ] },
]

export default async function History() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/about" current="/about/history" title="History">
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
