'use server'

import { createClient } from '@supabase/supabase-js'
import { firstPaymentUsd, isBeta, planEnById, usd, type BillingEn } from '@/lib/pricing-global'
import { HOME_LAYOUTS } from '@/lib/home-layouts'
import { PRIVACY_VERSION_EN, TERMS_VERSION_EN } from '@/lib/service-terms-en'
import { ISSUER, PRODUCT } from '@/lib/product'
import { noticeMail, sendMails } from '@/lib/mail'
import { paymentDbSecret } from '@/lib/toss'

export type ApplyStateEn = { ok?: boolean; error?: string }

const OUTLET_COUNTS = ['Launching soon', '1', '2-5', '6+']

// English application form (international customers). Saved to the same table as the Korean form;
// USD quote, country and design are written at the top of the notes so the team sees them on the lead card.
export async function submitApplicationEn(_prev: ApplyStateEn, form: FormData): Promise<ApplyStateEn> {
  if (String(form.get('website') ?? '')) return { ok: true }

  const get = (k: string, max: number) => String(form.get(k) ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  const company = get('company', 80)
  const contactName = get('contact_name', 40)
  const phone = get('phone', 30)
  const email = get('email', 120)
  const country = get('country', 60)
  const outletCount = get('outlet_count', 20)
  const currentCms = get('current_cms', 80)
  const domain = get('domain', 120).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()
  const design = HOME_LAYOUTS.find((l) => l.ready && l.key === get('design', 20))
  const typed = String(form.get('message') ?? '').trim().slice(0, 1500)
  const plan = planEnById(get('plan', 20))
  const billing: BillingEn = get('billing', 10) === 'annual' ? 'annual' : 'monthly'

  if (!plan) return { error: 'Please choose a plan.' }
  if (!company) return { error: 'Please enter your publication name (a planned name is fine).' }
  if (!contactName) return { error: 'Please enter your name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Please enter an email address we can reach you at.' }
  if (!country) return { error: 'Please tell us your country.' }
  if (phone && phone.replace(/\D/g, '').length < 7) return { error: 'Please check your phone number or leave it blank.' }
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: 'Please check the domain, for example mynews.com' }
  if (form.get('agree') !== 'on') return { error: 'Please accept the Privacy Policy to apply.' }
  if (form.get('agree_terms') !== 'on') return { error: 'Please accept the Terms of Service to apply.' }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: 'Applications are temporarily unavailable. Please try again shortly.' }
  const pay = firstPaymentUsd(plan, billing)
  const quote = pay ? `First payment ${usd(pay.total)} USD${isBeta() ? ' (beta: 50% off first 3 months, setup fee waived)' : ''}` : 'Enterprise: custom quote'
  const message = [
    `[International · English] ${plan.name} · ${billing === 'annual' ? 'Annual' : 'Monthly'} · ${quote} · Country: ${country}`,
    design ? `[Preferred homepage layout] ${design.name} · ${design.label}` : '',
    typed,
  ].filter(Boolean).join('\n\n').slice(0, 2000)

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const base = {
    company, contact_name: contactName, phone: phone || '-', email,
    outlet_count: OUTLET_COUNTS.includes(outletCount) ? outletCount : null,
    current_cms: currentCms || null,
  }
  const viaServer = process.env.PAYMENT_DB_SECRET
    ? await supabase.rpc('apply_submit', {
        secret: paymentDbSecret(),
        p: {
          ...base, outlet_count: base.outlet_count ?? '', current_cms: currentCms, message, plan: plan.id, billing, domain,
          terms_version: TERMS_VERSION_EN, privacy_version: PRIVACY_VERSION_EN, quoted_total: null, beta_discount: isBeta(),
        },
      })
    : null
  if (viaServer) {
    if (viaServer.error) return { error: 'We could not save your application. Please try again shortly.' }
    if (viaServer.data == null) return { ok: true } // repeated submission: already received
  } else {
    const now = new Date().toISOString()
    const { error } = await supabase.from('beta_requests').insert({
      ...base, agreed_at: now, message, plan: plan.id, billing, domain: domain || null,
      terms_agreed_at: now, terms_version: TERMS_VERSION_EN, privacy_version: PRIVACY_VERSION_EN, quoted_total: null, beta_discount: isBeta(),
    })
    if (error) return { error: 'We could not save your application. Please try again shortly.' }
  }

  const toApplicant = noticeMail({
    title: `We received your application: ${company}`,
    lines: [
      `Hi ${contactName}, thanks for applying to ${PRODUCT.name}. A member of our team will email you within 2 business days to schedule your launch and walk you through the contract.`,
      `Your application: ${plan.name} plan · ${billing === 'annual' ? 'annual billing' : 'monthly billing'} · ${quote}${domain ? ` · domain ${domain}` : ''}.`,
      'Nothing is charged yet. Payment is requested only after you have reviewed and confirmed the contract. You can reply to this email with any questions.',
    ],
    footer: `This email confirms your ${PRODUCT.name} application. Questions: ${ISSUER.contact ?? ''}`,
  })
  const toStaff = noticeMail({
    title: `New international application: ${company}`,
    lines: [
      `${contactName} · ${phone || 'no phone'} · ${email} · ${country}`,
      `${plan.name} · ${billing} · ${quote}`,
      [domain && `domain ${domain}`, outletCount && `titles ${outletCount}`, currentCms && `current CMS ${currentCms}`].filter(Boolean).join(' · ') || 'No extra details',
      typed ? `Notes: ${typed.slice(0, 500)}` : 'No notes',
      'Told them we reply within 2 business days (English).',
    ],
    button: { label: 'Open in customer inquiries', url: `${PRODUCT.appUrl}/admin/leads` },
    footer: 'Internal notification.',
  })
  const mails = [{ to: email, subject: `[${PRODUCT.name}] We received your application`, ...toApplicant, replyTo: ISSUER.contact, tag: 'apply-en' }]
  if (ISSUER.contact) mails.push({ to: ISSUER.contact, subject: `[New · International] ${company} · ${plan.name}`, ...toStaff, replyTo: email, tag: 'apply-staff-en' })
  await sendMails(mails).catch(() => null)
  return { ok: true }
}
