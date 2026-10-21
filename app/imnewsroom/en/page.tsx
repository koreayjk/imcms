import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { PRODUCT, isProductHost } from '@/lib/product'
import { BETA_END_LABEL_EN, BETA_MONTHS, PLANS_EN, SETUP_FEE_USD, SETUP_WAIVER_MONTHS, firstPaymentUsd, isBeta, usd } from '@/lib/pricing-global'
import { LAYOUTS_EN } from '@/lib/home-layouts-en'
import ApplyFormEn from '@/components/product/ApplyFormEn'
import PricingEn from '@/components/product/PricingEn'
import HomeLayoutThumb from '@/components/cms/HomeLayoutThumb'
import IslandNav from '@/components/product/IslandNav'
import { Pill } from '@/components/product/Pill'
import { Reveal } from '@/components/product/Motion'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const indexable = PRODUCT.indexable && isProductHost((await headers()).get('host'))
  const title = `${PRODUCT.name} — The AI newsroom and website for independent publishers`
  const description = 'Write, review and publish from one place: AI drafts checked against your sources, editor approval, one account for several titles, newsletters and a fast news site. From $79 a month.'
  return {
    title,
    description,
    openGraph: { type: 'website', siteName: PRODUCT.name, title, description, locale: 'en_US', images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [PRODUCT.ogImage] },
    ...(indexable ? { robots: { index: true, follow: true }, alternates: { canonical: `${PRODUCT.url}/en`, languages: { en: `${PRODUCT.url}/en`, ko: `${PRODUCT.url}/` } } } : {}),
  }
}

const NAV_EN = { home: 'Back to top', menu: 'Site menu', all: 'All sections', login: 'Sign in', trial: 'Apply now', trialLong: 'Apply now', openMenu: 'Open menu', closeMenu: 'Close menu', loginLong: 'Already a customer? Sign in' }

const FEATURES = [
  { t: 'AI drafts you can trust', d: 'Turn a press release, notes or a source document into a draft. Every draft is checked against the source text and always saved as a draft: a human publishes.' },
  { t: 'Reporter to editor, with a trail', d: 'Draft, submit, approve or return, publish. Auto-save, revision history with one-click restore, and scheduled publishing.' },
  { t: 'Several titles, one account', d: 'Run multiple publications with per-title roles. Publish one story to several titles at once with the original marked to avoid duplicates.' },
  { t: 'A fast, search-ready site', d: 'News sitemap, RSS and structured data for Google out of the box. We set up Google Search Console and submit your sitemap for you.' },
  { t: 'Photos and video in the story', d: 'Upload photos with automatic watermarking, or video files up to 1 GB, straight from a laptop or phone. Storage is tracked per plan.' },
  { t: 'Newsletters built in', d: 'Weekly or twice-weekly sends from your own site subscribers (Standard and Premium).' },
  { t: 'Control over AI crawlers', d: 'Choose whether AI training bots may collect your articles while still allowing AI search to cite you. One setting, per title.' },
  { t: 'Secure by default', d: 'Two-factor authentication, sign-in history, remote sign-out and role-based access. Departed staff can be suspended in one click.' },
  { t: 'Mobile newsroom', d: 'Write, approve and publish from your phone with the Android app.' },
]

const STEPS = [
  { t: 'Apply', d: 'Tell us about your publication. No payment now.' },
  { t: 'We build it', d: 'We open your newsroom and site, apply your logo and colors, connect your domain and move your archive.' },
  { t: 'You publish', d: 'We walk your team through it one-on-one. You are live in days, not months.' },
]

const faq = (beta: boolean) => [
  { q: 'Who is IM Newsroom for?', a: 'Independent and community publishers, association and faith-based media, specialty trade titles and multi-title groups that want a newsroom, a website and AI assistance in one affordable service rather than stitching plugins together.' },
  { q: 'What language is the newsroom interface in?', a: 'Your public website can be fully in English (menus, dates and policies included). The newsroom dashboard your staff use is currently in Korean, and an English interface is on our roadmap. We onboard your team personally and provide English guides in the meantime. If you need the English dashboard before launch, tell us in the application and we will tell you honestly where it stands.' },
  { q: 'Which countries can use it?', a: 'Anywhere. The service is provided by a US company, invoiced in US dollars, and runs on global cloud infrastructure. Some features, such as AI risk review, are currently tuned to Korean media law; elsewhere treat them as an editorial checklist and not legal advice.' },
  { q: 'Can I use my own domain?', a: 'Yes. You keep ownership of your domain. We tell you exactly which DNS records to add and confirm it is working.' },
  { q: 'Can you move my existing articles?', a: 'Yes, on request. We move articles and photos and set up redirects from old URLs where feasible, so your search rankings are not lost. Scope depends on your current system and is agreed up front.' },
  { q: 'How does AI drafting work, and is my data used for training?', a: 'We send your source text and instructions to Anthropic and Google under paid terms where they do not train models on your data. AI output is a starting point for a reporter to check; you decide what to publish.' },
  { q: 'What does it cost?', a: `Plans start at ${usd(79)} a month. There is a one-time setup fee of ${usd(SETUP_FEE_USD)} that covers launch, customization, domain connection and migration support. Pay annually and get one month free. Prices are final prices. Any sales, VAT or similar tax your country requires is your responsibility.` },
  { q: 'Is there a launch offer?', a: beta ? `Yes. Apply by ${BETA_END_LABEL_EN} and get 50% off the plan fee for your first ${BETA_MONTHS} months, with the setup fee waived. The waiver assumes you stay at least ${SETUP_WAIVER_MONTHS} months after launch; if you cancel earlier, we charge the waived setup fee.` : 'Ask us about current offers.' },
  { q: 'Can I cancel?', a: 'Any time. Monthly plans run to the end of the month you cancel. Annual plans are refunded for unused months. We give you your articles and photos as downloadable files and keep your data for 30 days after you leave.' },
  { q: 'How do I pay?', a: 'We invoice in US dollars. After you confirm the contract we send an invoice you can pay by card. We never store card numbers.' },
]

const jsonLd = (beta: boolean) => JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'SoftwareApplication', name: PRODUCT.name, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android', url: `${PRODUCT.url}/en`, inLanguage: 'en', offers: { '@type': 'Offer', price: '79', priceCurrency: 'USD' } },
    { '@type': 'FAQPage', mainEntity: faq(beta).map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  ],
}).replace(/</g, '\\u003c')

const H2 = 'text-[30px] font-extrabold leading-[1.18] tracking-[-0.035em] [text-wrap:balance] sm:text-[42px]'

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <BrandMark size={34} />
      <span className="text-[18px] font-extrabold tracking-[-0.02em]">IM Newsroom</span>
    </span>
  )
}

export default function ProductHomeEn() {
  const beta = isBeta()
  const std = firstPaymentUsd(PLANS_EN[1], 'monthly')
  const FAQ = faq(beta)
  return (
    <div lang="en" className="min-h-screen overflow-x-hidden bg-white text-[#14171C]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(beta) }} />
      <IslandNav
        logo={<Logo />}
        items={[{ href: '#features', label: 'Features' }, { href: '#layouts', label: 'Layouts' }, { href: '#how', label: 'How it works' }, { href: '#pricing', label: 'Pricing' }, { href: '#faq', label: 'FAQ' }]}
        loginHref={`${PRODUCT.appUrl}/login`}
        trialHref="#apply"
        labels={NAV_EN}
      />
      <main id="top">
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-white pb-24 pt-32 sm:pt-40 lg:pb-32">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_78%_18%,rgba(29,52,97,0.13),transparent_70%),radial-gradient(40%_35%_at_8%_70%,rgba(232,89,12,0.07),transparent_70%)]" />
          <div className="mx-auto grid max-w-[1200px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr]">
            <div>
              {beta && (
                <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-[12.5px] font-medium text-[#5B616B] shadow-[inset_0_0_0_1px_rgba(232,89,12,0.18)]">
                  <b className="font-semibold text-[#C2410C]">Launch offer: apply by {BETA_END_LABEL_EN} for 50% off your first {BETA_MONTHS} months</b>
                </p>
              )}
              <h1 className="mt-7 text-[34px] font-extrabold leading-[1.1] tracking-[-0.045em] [text-wrap:balance] sm:text-[50px]">
                The newsroom, the website and the AI assistant. <span className="text-[#1D3461]">One service.</span>
              </h1>
              <p className="mt-6 max-w-[34em] text-[18px] leading-[1.7] text-[#5B616B]">
                Write, review and publish from one place. AI drafts checked against your sources, editor approval, several titles on one account, newsletters and a fast news site, from <b className="font-semibold text-[#0F1115]">$79 a month</b>.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Pill href="#apply">Apply now</Pill>
                <Pill href="#pricing" tone="light">See pricing</Pill>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13.5px] text-[#5B616B]">
                <li>✓ Nothing charged when you apply</li>
                <li>✓ Your own domain</li>
                <li>✓ We move your archive</li>
                <li>✓ Cancel any time</li>
              </ul>
            </div>

            {/* Workflow card stack */}
            <div className="relative mx-auto w-full max-w-[520px]" aria-hidden>
              <div className="rounded-3xl bg-[#F4F6FA] p-4 shadow-[0_40px_90px_-40px_rgba(16,24,40,0.45)] ring-1 ring-black/5 sm:p-6">
                <div className="space-y-3">
                  {[
                    { k: 'Source', t: 'City council approves transit budget', s: 'Press release · 3 attachments', c: '#5B616B' },
                    { k: 'AI draft', t: 'Council backs $12M transit plan', s: 'Checked against source · 2 notes for the reporter', c: '#7C3AED' },
                    { k: 'Editor', t: 'Approved by M. Rivera', s: 'Scheduled for 7:30 AM', c: '#1D3461' },
                    { k: 'Published', t: 'Live on 3 titles', s: 'Sitemap and newsletter updated', c: '#3F7D5C' },
                  ].map((r) => (
                    <div key={r.k} className="flex items-center gap-4 rounded-2xl bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(15,17,21,0.04)]">
                      <span className="w-[68px] shrink-0 rounded-full px-2 py-1 text-center text-[11px] font-bold text-white" style={{ background: r.c }}>{r.k}</span>
                      <span className="min-w-0"><span className="block truncate text-[14.5px] font-bold">{r.t}</span><span className="block truncate text-[12.5px] text-[#5B616B]">{r.s}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal className="text-center">
              <p className="text-[13px] font-semibold tracking-[0.06em] text-[#1D3461]">WHAT YOU GET</p>
              <h2 className={`mt-3 ${H2}`}>Everything a small newsroom needs, nothing it doesn&apos;t</h2>
            </Reveal>
            <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <li key={f.t}>
                  <Reveal delay={(i % 3) * 70} className="h-full">
                    <div className="h-full rounded-2xl bg-white p-6 ring-1 ring-black/5">
                      <p className="text-[17px] font-extrabold tracking-[-0.02em]">{f.t}</p>
                      <p className="mt-2 text-[14.5px] leading-[1.7] text-[#5B616B]">{f.d}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Layouts */}
        <section id="layouts" className="scroll-mt-16 bg-white">
          <div className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal className="text-center">
              <p className="text-[13px] font-semibold tracking-[0.06em] text-[#1D3461]">HOMEPAGE LAYOUTS</p>
              <h2 className={`mt-3 ${H2}`}>Pick the look that fits your publication</h2>
              <p className="mx-auto mt-4 max-w-[38em] text-[17px] leading-[1.75] text-[#5B616B]">Five homepage layouts, ready to go. We apply your logo and colors and you can change layout any time. Your editors also curate the lead stories by hand.</p>
            </Reveal>
            <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {LAYOUTS_EN.map((l, i) => (
                <li key={l.key}>
                  <Reveal delay={i * 70} className="h-full">
                    <div className="h-full rounded-2xl bg-[#F7F8FA] p-3.5 ring-1 ring-black/5 sm:p-4">
                      <HomeLayoutThumb layout={l.key} />
                      <p className="mt-3.5 text-[15.5px] font-extrabold tracking-[-0.02em]">{l.name}</p>
                      <p className="text-[13.5px] font-semibold text-[#1D3461]">{l.label}</p>
                      <p className="mt-2 text-[12.5px] leading-[1.6] text-[#5B616B]">{l.features}</p>
                      <p className="mt-2 text-[12px] font-semibold text-[#3B4048]">Good for: {l.fit}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[1000px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal className="text-center"><h2 className={H2}>Live in days, with a person beside you</h2></Reveal>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.t}>
                  <Reveal delay={i * 80} className="h-full">
                    <div className="h-full rounded-2xl bg-white p-6 ring-1 ring-black/5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1D3461] text-[14px] font-bold text-white">{i + 1}</span>
                      <p className="mt-4 text-[17px] font-extrabold tracking-[-0.02em]">{s.t}</p>
                      <p className="mt-2 text-[14.5px] leading-[1.7] text-[#5B616B]">{s.d}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Pricing */}
        <PricingEn />

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 bg-white">
          <div className="mx-auto max-w-[820px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal className="text-center"><h2 className={H2}>Questions</h2></Reveal>
            <div className="mt-10 divide-y divide-[#EEF0F3] rounded-2xl bg-white ring-1 ring-black/5">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-5 py-4 sm:px-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold [&::-webkit-details-marker]:hidden">
                    {f.q}<span className="text-[#8C929B] transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-[1.75] text-[#5B616B]">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Apply */}
        <section id="apply" className="scroll-mt-16 bg-[#F7F8FA]">
          <div className="mx-auto max-w-[760px] px-4 py-24 sm:px-6 lg:py-28">
            <Reveal className="text-center">
              <h2 className={H2}>Apply</h2>
              <p className="mt-4 text-[16.5px] leading-[1.75] text-[#5B616B]">Tell us about your publication. We reply within 2 business days. {std && beta ? <>Your first payment on Standard would be {usd(std.total)}. </> : ''}Nothing is charged until you confirm the contract.</p>
            </Reveal>
            <div className="mt-10"><ApplyFormEn /></div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#EEF0F3] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13.5px] text-[#5B616B] sm:px-6">
          <p>© {new Date().getFullYear()} IM America Group Corp (IM Genesis) · <a href="mailto:contact@imnewsroom.com" className="underline underline-offset-2">contact@imnewsroom.com</a></p>
          <nav className="flex gap-5" aria-label="Legal">
            <Link href="/imnewsroom/en/terms" className="hover:text-[#14171C]">Terms of Service</Link>
            <Link href="/imnewsroom/en/privacy" className="hover:text-[#14171C]">Privacy Policy</Link>
            <Link href="/imnewsroom" className="hover:text-[#14171C]">한국어</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
