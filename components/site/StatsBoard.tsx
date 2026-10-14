import type { StatsBoard as Board } from '@/lib/sites'

// 홈 오른쪽 '숫자 판' (예: 선교 통계). 숫자마다 출처를 작게 붙인다
export default function StatsBoard({ board }: { board: Board }) {
  return (
    <section aria-labelledby="stats-board-title" className="border-t-[3px] border-brand bg-soft px-4 pb-4 pt-3.5">
      <h3 id="stats-board-title" className="text-[16px] font-bold tracking-[-0.02em] text-brand">{board.title}</h3>
      <dl className="mt-3 divide-y divide-rule">
        {board.items.map((x, i) => (
          <div key={i} className="py-2.5 first:pt-0">
            <dt className="text-[12.5px] text-sub">{x.label}</dt>
            <dd className="mt-0.5">
              <span className="text-[22px] font-extrabold tabular-nums tracking-[-0.02em] text-body">{x.value}</span>
              {x.note && <span className="ml-1.5 text-[12px] text-sub">{x.note}</span>}
              {x.source && (
                <span className="mt-0.5 block text-[11px] text-[#8A918C]">
                  자료: {x.url ? <a href={x.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-brand">{x.source}</a> : x.source}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {board.footnote && <p className="mt-2 border-t border-rule pt-2 text-[11px] leading-[1.6] text-[#8A918C]">{board.footnote}</p>}
    </section>
  )
}
