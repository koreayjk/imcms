import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Mission & Vision' }

const GOALS = [
  ['Trust', 'We earn readers’ trust with ethical standards built on fact-checking and prompt corrections.'],
  ['Cooperation', 'Story sharing, joint reporting and shared technology help even small outlets grow.'],
  ['Expertise', 'We support in-depth reporting by specialist outlets and keep training journalists.'],
  ['Innovation', 'We build digital journalism that uses AI, data and other new technology responsibly.'],
]

export default async function Vision() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/about" current="/about/vision" title="Mission & Vision">
      <section>
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">Our mission</h2>
        <p className="mt-3 text-[16.5px] leading-[1.85]">The Association exists so that digital news outlets and journalists can work together to defend both the freedom and the responsibility of the press, build a healthy digital news culture and serve the public interest.</p>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">Our vision</h2>
        <p className="mt-3 rounded-lg bg-[var(--g-navy)] px-6 py-5 text-[19px] font-bold leading-[1.6] text-white">Trusted digital journalism, and a press community that grows together</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {GOALS.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-[var(--g-line)] p-5">
              <p className="text-[18px] font-extrabold text-[var(--g-gold-ink)]">{t}</p>
              <p className="mt-1.5 text-[15px] leading-[1.75] text-[var(--g-sub)]">{d}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">What we do</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>Adopting and running a code of ethics and self-regulation rules for the press</li>
          <li>Story sharing, joint reporting projects and content partnerships among members</li>
          <li>Training and seminars for reporters and editors (digital reporting, use of AI, media law)</li>
          <li>Technical support for members (newsroom system, websites, search visibility)</li>
          <li>Press awards that recognize outstanding reporting</li>
          <li>Protecting the rights of member outlets and journalists, and proposing better rules</li>
        </ul>
      </section>
    </SubPage>
  )
}
