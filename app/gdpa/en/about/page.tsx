import type { Metadata } from 'next'
import { GDPA, GDPA_EN } from '@/lib/gdpa'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Greeting' }

export default async function Greeting() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/about" current="/about" title="Greeting">
      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <div className="flex items-start justify-center md:justify-start"><img src="/gdpa/logo-mark.svg" alt="" className="h-[150px] w-[150px]" /></div>
        <div className="space-y-5 text-[16.5px] leading-[1.85]">
          <p className="text-[22px] font-bold leading-[1.5] text-[var(--g-navy)]">“Together, we will build journalism that people can trust in the digital age.”</p>
          <p>Welcome, and thank you for visiting the website of the {GDPA_EN.name} ({GDPA.short}).</p>
          <p>The way news is made and read is changing fast. When anyone can write and spread a story, the duty of the press to check the facts and report them responsibly only grows heavier. Our association brings digital news outlets together to share this duty and to grow by sharing our experience and technology.</p>
          <p>We will work to set and uphold ethical standards, to share stories and plan joint reporting among our members, to train journalists and share digital and AI technology, and to protect the rights of member outlets and journalists. We believe that when outlets with their own specialties — health and welfare, international logistics, Israel and Christian news, and more — work together, readers get deeper and broader news.</p>
          <p>We ask for your interest and support as our new association sets out. Thank you.</p>
          <p className="pt-2 text-right font-bold">The officers and staff of the {GDPA_EN.name}</p>
        </div>
      </div>
    </SubPage>
  )
}
