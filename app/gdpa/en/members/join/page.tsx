import type { Metadata } from 'next'
import Link from 'next/link'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'How to Join' }

const STEPS = [
  ['Inquire and apply', 'Sign up on this website and apply as a “Member outlet”, or contact the Secretariat.'],
  ['Send documents', 'Send the documents listed below to the Secretariat.'],
  ['Review', 'The Secretariat reviews your application and the Board of Directors decides on admission.'],
  ['Admission', 'We let you know the result and add your outlet to the list of members.'],
]

export default async function Join() {
  const base = await gdpaBaseEn()
  return (
    <SubPage base={base} lang="en" section="/members" current="/members/join" title="How to Join">
      <section>
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">Who can join</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>Digital news outlets, such as internet newspapers registered under Korea’s Act on the Promotion of Newspapers</li>
          <li>Outlets that agree with and follow the Association’s purpose and code of ethics</li>
          <li>Outlets that publish stories regularly (the membership rules set the minimum operating period and number of stories)</li>
        </ul>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">How it works</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-lg border border-[var(--g-line)] p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--g-navy)] text-[14px] font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-1 text-[14px] leading-[1.65] text-[var(--g-sub)]">{d}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">Documents</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>Membership application form (provided by the Secretariat)</li>
          <li>Copy of the periodical (internet newspaper) registration certificate</li>
          <li>Copy of the business registration certificate</li>
          <li>Outlet profile (publisher and editor, main areas of coverage, website address)</li>
        </ul>
        <p className="mt-4 rounded-lg bg-[var(--g-soft)] px-5 py-3 text-[14.5px] text-[var(--g-sub)]">The entrance fee and annual dues will be announced once they are set at the founding general assembly.</p>
      </section>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href={`${base}/signup`} className="rounded bg-[var(--g-navy)] px-6 py-3 font-bold text-white">Sign up and apply</Link>
        <Link href={`${base}/about/contact`} className="rounded border border-[var(--g-line)] px-6 py-3 font-semibold">Contact the Secretariat</Link>
      </div>
    </SubPage>
  )
}
