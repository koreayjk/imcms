import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'FAQ' }

const FAQ: [string, string][] = [
  ['Who can sign up?', 'Anyone aged 14 or older can apply. Once the Secretariat checks and approves your application, you can use member services.'],
  ['What is the difference between individual members and member outlets?', 'Individual members receive GDPA news and notices of events and training. A member outlet is a news organization that joins the Association; it must submit membership documents and is reviewed by the Board of Directors.'],
  ['What do member outlets get?', 'A profile and stories on the GDPA website, story sharing and joint projects, training for journalists and technical support. See “Member Benefits” for details.'],
  ['How much are the entrance fee and annual dues?', 'They will be announced once they are set at the founding general assembly.'],
  ['I forgot my password.', 'Click “Reset password” on the login page and enter the email you signed up with. We will send you a reset email.'],
  ['How do I close my account?', 'Request it from “My account” or contact the Secretariat, and we will process it right away. When you leave, we destroy your personal information without delay.'],
]

export default async function Faq() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/notice" current="/faq" title="FAQ">
      <ul className="divide-y divide-[var(--g-line)] border-y-2 border-[var(--g-navy)]">
        {FAQ.map(([q, a]) => (
          <li key={q}>
            <details className="group px-2 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-[16.5px] font-bold">
                <span className="text-[var(--g-gold-ink)]">Q</span>{q}
                <span aria-hidden className="ml-auto text-[var(--g-sub)] transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-3 pl-7 text-[15.5px] leading-[1.8] text-[var(--g-sub)]">{a}</p>
            </details>
          </li>
        ))}
      </ul>
    </SubPage>
  )
}
