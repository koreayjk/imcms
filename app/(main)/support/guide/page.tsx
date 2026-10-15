import type { Metadata } from 'next'
import Link from 'next/link'
import { CHECKLIST, GUIDE, GUIDE_UPDATED, NAVER_RULE, PENALTY_TABLE } from '@/lib/writing-guide'

export const metadata: Metadata = { title: '기사 작성 가이드' }

// 고객센터 → 기사 작성 가이드 (내용은 lib/writing-guide.ts. AI 초안도 같은 규칙을 쓴다)
export default function WritingGuidePage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">기사 작성 가이드</h1>
          <p className="mt-1 text-[13.5px] text-muted">네이버 뉴스제휴 운영평가 기준에 맞춘 IM 뉴스룸 기사 작성·송출 원칙 · {GUIDE_UPDATED} 기준</p>
        </div>
        <a href="#checklist" className="rounded-full bg-[#2F6BF0] px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90">발행 전 체크리스트 ↓</a>
      </div>

      <div className="mt-6 rounded-2xl bg-[#FFF6E5] p-5 text-[14px] leading-relaxed ring-1 ring-[#F5A524]/30">
        <p className="font-bold">네이버 운영평가: 24개월 누적 부정 평가 점수 10점 → 제휴 계약 해지 권고</p>
        <p className="mt-1 text-[#5B4A1F]">기사 한 건에 0.5~4점, 부당한 대가 요구는 한 번에 10점입니다. AI 초안도 이 가이드의 문장·제목 규칙을 지켜 쓰도록 되어 있지만, 발행 책임은 기자와 승인한 편집장에게 있습니다.</p>
      </div>

      <nav aria-label="가이드 목차" className="mt-6 flex flex-wrap gap-2 text-[13px]">
        {GUIDE.map((s) => <a key={s.id} href={`#${s.id}`} className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/10 hover:ring-ink">{s.title}</a>)}
        <a href="#penalty" className="rounded-full bg-white px-3 py-1.5 ring-1 ring-black/10 hover:ring-ink">벌점표</a>
      </nav>

      <div className="mt-8 space-y-5">
        {GUIDE.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-6 rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <h2 className="text-[17px] font-extrabold">{s.title}</h2>
            {s.lead && <p className="mt-2 text-[14px] leading-relaxed text-[#3B4048]">{s.lead}</p>}
            <ul className="mt-3 space-y-2">
              {s.items.map((it, i) => (
                <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                  <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#E5483A]" />
                  <span className="flex-1">
                    {it.text}
                    {it.point && <span className="ml-1.5 whitespace-nowrap rounded bg-[#F1F2F4] px-1.5 py-0.5 align-[1px] text-[11px] font-semibold text-muted" title="네이버 운영평가 항목">평가 {it.point}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section id="checklist" className="mt-10 scroll-mt-6 rounded-2xl bg-[#0B1020] p-6 text-white md:p-8">
        <h2 className="text-[18px] font-extrabold">발행 전 체크리스트</h2>
        <p className="mt-1 text-[13.5px] text-white/60">승인 신청 전에 기자가, 승인 전에 편집장이 한 번 더 확인합니다.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {CHECKLIST.map((c) => (
            <li key={c} className="flex gap-2.5 rounded-lg bg-white/5 px-3.5 py-2.5 text-[14px]">
              <span aria-hidden className="text-[#7CE3A6]">☐</span>{c}
            </li>
          ))}
        </ul>
      </section>

      <section id="penalty" className="mt-10 scroll-mt-6">
        <h2 className="text-[18px] font-extrabold">네이버 운영평가 항목과 부정 평가 점수</h2>
        <p className="mt-1 text-[13px] text-muted">{NAVER_RULE}. 가이드 안의 "평가 ○" 표시는 아래 항목입니다.</p>
        {/* 휴대폰: 칸이 합쳐진 표 대신 분야별 목록 */}
        <div className="mt-4 space-y-3 md:hidden">
          {PENALTY_TABLE.map((g) => (
            <section key={g.area} className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
              <h3 className="text-[13.5px] font-bold">{g.area}</h3>
              <ul className="mt-2 divide-y divide-line">
                {g.rows.map(([item, pt]) => (
                  <li key={item} className="flex items-baseline justify-between gap-3 py-2 text-[13.5px]">
                    <span className="min-w-0">{item}</span>
                    <span className={`shrink-0 whitespace-nowrap tabular-nums ${pt === '10점' ? 'font-bold text-danger' : ''}`}>{pt}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5 md:block">
          <table className="w-full min-w-[560px] text-[13.5px]">
            <thead>
              <tr className="border-b border-line bg-[#F7F8FA] text-left text-[12.5px] text-muted">
                <th className="px-4 py-2.5 font-semibold">분야</th>
                <th className="px-4 py-2.5 font-semibold">평가 항목</th>
                <th className="px-4 py-2.5 text-right font-semibold">점수</th>
              </tr>
            </thead>
            <tbody>
              {PENALTY_TABLE.flatMap((g) => g.rows.map(([item, pt], i) => (
                <tr key={item} className="border-b border-line last:border-0">
                  {i === 0 && <td rowSpan={g.rows.length} className="align-top px-4 py-2.5 font-semibold">{g.area}</td>}
                  <td className="px-4 py-2.5">{item}</td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right tabular-nums ${pt === '10점' ? 'font-bold text-danger' : ''}`}>{pt}</td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px] text-muted">
          규정이 바뀌면 이 페이지를 고쳐 공지로 알려 드립니다. 궁금한 점은 <Link href="/support/tickets/new" className="font-semibold text-[#2F6BF0] hover:underline">업무요청</Link>으로 물어봐 주세요.
        </p>
      </section>
    </div>
  )
}
