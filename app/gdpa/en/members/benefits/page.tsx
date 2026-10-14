import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Member Benefits' }

const BENEFITS = [
  ['GDPA member status', 'Show your GDPA membership on your website, and have your profile and stories featured on the GDPA website.'],
  ['Story sharing and joint projects', 'Widen your coverage through story sharing and joint reporting with other members.'],
  ['Training for journalists', 'Join training and seminars on digital reporting, the use of AI, and media law and ethics.'],
  ['Digital technology support', 'Get technical support such as a newsroom system (IM Newsroom), website building and search visibility.'],
  ['Legal and dispute advice', 'Basic advice and materials on handling press disputes and correction requests.'],
  ['Awards and events', 'Take part in GDPA press awards and member events.'],
]

export default async function Benefits() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/members" current="/members/benefits" title="Member Benefits">
      <ul className="grid gap-5 sm:grid-cols-2">
        {BENEFITS.map(([t, d], i) => (
          <li key={t} className="rounded-lg border border-[var(--g-line)] p-6">
            <p className="text-[13px] font-bold text-[var(--g-gold-ink)]">Benefit {i + 1}</p>
            <p className="mt-1 text-[18px] font-bold">{t}</p>
            <p className="mt-2 text-[15px] leading-[1.75] text-[var(--g-sub)]">{d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-[14px] text-[var(--g-sub)]">The details and conditions of each benefit follow the Association’s rules. Any changes will be posted in Announcements.</p>
    </SubPage>
  )
}
