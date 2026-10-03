import type { PolicySection } from '@/lib/gdpa-policies'
import { GDPA_PROCESSORS } from '@/lib/gdpa-policies'

// 약관·방침 본문 (배열은 첫 줄이 머리말, 나머지는 목록)
export default function PolicyBody({ sections }: { sections: PolicySection[] }) {
  return (
    <div className="space-y-8 text-[15.5px] leading-[1.85]">
      {sections.map((s) => (
        <section key={s.title}>
          <h2 className="mb-2 text-[17px] font-bold text-[var(--g-navy)]">{s.title}</h2>
          {s.body.map((b, i) => {
            if (b === '__processors__') {
              return (
                <div key={i} className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
                    <thead><tr className="bg-[var(--g-soft)] text-left">{['받는 곳', '나라', '하는 일', '항목'].map((h) => <th key={h} className="border border-[var(--g-line)] px-3 py-2">{h}</th>)}</tr></thead>
                    <tbody>{GDPA_PROCESSORS.map((p) => <tr key={p.name}>{[p.name, p.country, p.what, p.items].map((c, j) => <td key={j} className="border border-[var(--g-line)] px-3 py-2 align-top">{c}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )
            }
            if (Array.isArray(b)) {
              const [head, ...rest] = b
              return (
                <div key={i} className="mt-2">
                  <p>{head}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-6">{rest.map((x, j) => <li key={j}>{x}</li>)}</ul>
                </div>
              )
            }
            return <p key={i} className="mt-2">{b}</p>
          })}
        </section>
      ))}
    </div>
  )
}
