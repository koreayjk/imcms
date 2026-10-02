import { PROCESSORS, type PolicySection } from '@/lib/service-terms'

// 약관·방침 본문 (소개 페이지의 전문 페이지와 신청서의 스크롤 상자가 같이 쓴다)
//   문자열은 문단, 배열은 [머리말?, …항목] 목록 — 첫 항목이 “…” 로 끝나면 머리말로 쓴다
export default function PolicyDoc({ sections, compact = false }: { sections: PolicySection[]; compact?: boolean }) {
  const h = compact ? 'text-[13.5px]' : 'text-[17px]'
  const p = compact ? 'text-[12.5px] leading-[1.75]' : 'text-[15px] leading-[1.85]'
  return (
    <div className={compact ? 'space-y-4' : 'space-y-9'}>
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className={`${h} font-bold text-[#14171C]`}>{s.title}</h2>
          <div className={`mt-2 space-y-2 text-[#3B4048] ${p}`}>
            {s.body.map((b, i) => {
              if (b === '__processors__') return <Processors key={i} compact={compact} />
              if (typeof b === 'string') return <p key={i}>{b}</p>
              const [first, ...rest] = b
              const lead = /[.:]$|다\.$/.test(first) && rest.length ? first : null
              const items = lead ? rest : b
              return (
                <div key={i}>
                  {lead && <p>{lead}</p>}
                  <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function Processors({ compact }: { compact: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[520px] border-collapse text-left ${compact ? 'text-[12px]' : 'text-[14px]'}`}>
        <thead>
          <tr className="border-b border-[#D5D8DD] text-[#14171C]">
            <th className="py-2 pr-3 font-semibold">받는 곳</th><th className="py-2 pr-3 font-semibold">국가·위치</th><th className="py-2 pr-3 font-semibold">맡기는 일</th><th className="py-2 font-semibold">항목</th>
          </tr>
        </thead>
        <tbody>
          {PROCESSORS.map((x) => (
            <tr key={x.name} className="border-b border-[#EEF0F3] align-top">
              <td className="py-2 pr-3 font-medium">{x.name}</td><td className="py-2 pr-3">{x.country}</td><td className="py-2 pr-3">{x.what}</td><td className="py-2">{x.items}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
