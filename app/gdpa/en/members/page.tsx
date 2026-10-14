import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import { memberOutlets } from '@/lib/gdpa-data'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Member Outlets' }
export const revalidate = 300

export default async function Members() {
  const outlets = await memberOutlets('en')
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/members" current="/members" title="Member Outlets" wide>
      <p className="mb-8 text-[15.5px] text-[var(--g-sub)]">GDPA has <strong className="text-[var(--g-navy)]">{outlets.length} member outlets</strong>. Click a website address to visit the outlet. Most members publish in Korean.</p>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {outlets.map((o, i) => (
          <li key={o.id} className="flex flex-col rounded-lg border border-[var(--g-line)] bg-white">
            <div className="flex h-[120px] items-center justify-center border-b border-[var(--g-line)] bg-[var(--g-soft)] px-6">
              {o.logo ? <img src={o.logo} alt={o.name} className="max-h-[64px] max-w-[260px] object-contain" /> : <span className="text-[24px] font-extrabold">{o.name}</span>}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-[12px] font-semibold text-[var(--g-gold-ink)]">Member {String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-1 text-[19px] font-bold">{o.name}</h2>
              <p className="mt-2 flex-1 text-[14.5px] leading-[1.7] text-[var(--g-sub)]">{o.intro}</p>
              {o.url && <a href={o.url} target="_blank" rel="noopener" className="mt-5 inline-flex w-fit items-center rounded border border-[var(--g-navy)] px-4 py-2 text-[14px] font-semibold text-[var(--g-navy)] hover:bg-[var(--g-navy)] hover:text-white">{o.domain} ↗</a>}
            </div>
          </li>
        ))}
      </ul>
    </SubPage>
  )
}
