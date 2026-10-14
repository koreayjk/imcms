import type { Metadata } from 'next'
import { GDPA, GDPA_EN } from '@/lib/gdpa'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Contact' }

export default async function Contact() {
  const o = GDPA.office
  const rows: [string, string][] = [
    ['Address', o.address || 'The Secretariat’s address will be announced here.'],
    ['Phone', o.phone || 'To be announced'],
    ['Email', o.email || 'To be announced'],
    ['Hours', GDPA_EN.hours],
  ]
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/about" current="/about/contact" title="Contact">
      <dl className="divide-y divide-[var(--g-line)] border-y-2 border-[var(--g-navy)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-4 py-4 text-[16px]">
            <dt className="font-bold text-[var(--g-navy)]">{k}</dt>
            <dd>{k === 'Email' && o.email ? <a href={`mailto:${o.email}`} className="underline underline-offset-2">{v}</a> : v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[14.5px] leading-[1.75] text-[var(--g-sub)]">For membership, partnerships, events and training, please contact us using the details above. Members receive announcements and event notices by email.</p>
    </SubPage>
  )
}
