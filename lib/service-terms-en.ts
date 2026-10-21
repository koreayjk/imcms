// IM Newsroom — Terms of Service and Privacy Policy for international customers (English).
//   The Korean documents (lib/service-terms.ts) govern customers contracting in Korean. These are for customers who sign up through /imnewsroom/en.
//   Draft v1: have counsel review before relying on it for real contracts (governing law, liability cap, data-protection terms).
import type { PolicySection } from './service-terms'
import { ISSUER, PRODUCT } from './product'
import { EXTRA_AI_USD, EXTRA_OUTLET_USD, SETUP_FEE_USD, SETUP_WAIVER_MONTHS, BETA_MONTHS, BETA_END_LABEL_EN, usd } from './pricing-global'

export const TERMS_VERSION_EN = 'en-2026-10-21'
export const TERMS_EFFECTIVE_EN = 'October 21, 2026'
export const PRIVACY_VERSION_EN = 'en-2026-10-21'

const co = () => ISSUER.legalName ?? 'IM America Group Corp'
const intro = () => `${co()}${ISSUER.dba ? ` (doing business as ${ISSUER.dba})` : ''} ("we", "us", the "Company")`
const mail = () => ISSUER.contact ?? 'contact@imnewsroom.com'

export function termsSectionsEn(): PolicySection[] {
  return [
    { title: '1. Purpose', body: [`These Terms govern how a news organization (the "Customer") uses ${PRODUCT.name}, a cloud newsroom and website service provided by ${intro()}. By submitting an application or using the service you agree to them on behalf of the Customer.`] },
    {
      title: '2. Definitions',
      body: [[
        'Service means the newsroom tools, publishing, AI drafting and review, press-release intake, outlet websites and support provided by the Company over the web',
        'Customer means the organization or publisher that signs up for the Service',
        'Users means the publishers, editors and reporters the Customer invites to sign in',
        'Content means articles, photos, videos and files the Customer and its Users upload to the Service',
        'Plan means a plan and its limits and price as published on the pricing page',
      ]],
    },
    {
      title: '3. Changes to these Terms',
      body: [
        'We may update these Terms. We will post the new version and email the Customer\'s contact at least 7 days before it takes effect (30 days if the change is unfavorable to the Customer).',
        'If the Customer does not agree to a change, it may cancel before the effective date without penalty. Continuing to use the Service after that date means the Customer accepts the change.',
      ],
    },
    {
      title: '4. Applying and acceptance',
      body: [
        'The Customer applies through the application form. We may ask for business documents needed for the contract.',
        [
          'We may decline an application, or later terminate the contract, if:',
          'the applicant used another person\'s or company\'s identity',
          'the application contains false information',
          'the applicant previously left unpaid fees to us',
          'the Service would be used for unlawful purposes',
        ],
      ],
    },
    {
      title: '5. The Service',
      body: [
        'What each Plan includes (AI uses, storage, banner and popup design requests, newsletter allowances and so on) is as published on the pricing page. We do not cap bandwidth for normal newsroom use.',
        'We may add or change features to improve the Service. We will give notice before removing or substantially changing a feature the Customer relies on.',
      ],
    },
    {
      title: '6. Onboarding and domain',
      body: [
        'After confirming the first payment or agreed start, we will tell the Customer about the launch schedule and the materials we need (logo, legal/footer information, domain).',
        'A delay in providing materials may delay the launch.',
        'The Customer owns its domain and is responsible for renewing it. We provide the DNS settings needed to connect it.',
      ],
    },
    {
      title: '7. Moving existing content',
      body: [
        'On request we will help move existing articles and photos from the Customer\'s previous system and set up redirects from old article addresses where feasible. Scope and timing depend on the source format and are agreed in advance.',
        'Some formatting may differ from the original after a move. The Customer reviews the result.',
      ],
    },
    {
      title: '8. Fees and payment',
      body: [
        `Fees are as published on the pricing page, in US dollars. Prices are final prices; we do not add Korean VAT. Where required by law, sales, use, GST or similar taxes in the Customer's jurisdiction are the Customer's responsibility.`,
        'Fees are paid in advance. We issue an invoice at the start of each billing period and the Customer pays by its due date. Annual billing covers 12 months and is charged as 11 months\' fees.',
        `The one-time setup fee is ${usd(SETUP_FEE_USD)} and covers opening the newsroom and site, customization, domain connection, content migration support and onboarding. It is waived for customers who apply before ${BETA_END_LABEL_EN}. Waiver is conditional on at least ${SETUP_WAIVER_MONTHS} months of use from launch (see section 10).`,
        `Customers who apply before ${BETA_END_LABEL_EN} receive 50% off the plan fee for the first ${BETA_MONTHS} months. Extra publications (${usd(EXTRA_OUTLET_USD)}/month each beyond those included in Premium) and extra AI usage (${usd(EXTRA_AI_USD)} per 100 uses) are not discounted.`,
        'Payments are processed by Stripe. We do not store card numbers. We give 30 days\' notice before raising prices and apply the new price only with the Customer\'s acceptance or after the notice period if the Customer continues to use the Service.',
      ],
    },
    {
      title: '9. Usage limits',
      body: [
        `If AI usage exceeds the monthly allowance the Customer may buy 100 more uses for ${usd(EXTRA_AI_USD)} or wait until next month. We notify the Customer before the limit is reached.`,
        'If storage exceeds the Plan or bandwidth is far above typical newsroom use for several months, we will contact the Customer to agree on a suitable Plan. We will not bill for temporary spikes the Customer did not cause (for example automated attacks).',
      ],
    },
    {
      title: '10. Cancellation and refunds',
      body: [
        `The Customer may cancel at any time by contacting ${mail()} or through the in-app support request.`,
        'Monthly billing: the Customer keeps access through the end of the month in which it cancels. Fees for that month are not refunded. Fees prepaid for later months are refunded.',
        'Annual billing: we refund the amount paid minus the months used at the monthly rate (with the same discount). The 1-month-free benefit applies only if the full year is used.',
        `Setup fee: not refundable after launch. If the setup fee was waived and the Customer cancels within ${SETUP_WAIVER_MONTHS} months of launch, we may charge the waived setup fee (${usd(SETUP_FEE_USD)}) and deduct it from any refund. It is not charged after ${SETUP_WAIVER_MONTHS} months, or if the Customer cancels because of our breach or because we end the Service.`,
        'If we end the Service or the Customer cancels because of our breach, we refund all prepaid fees for the remaining period.',
      ],
    },
    {
      title: '11. Your data after cancellation',
      body: [
        'On request we provide the Customer\'s articles and photos as downloadable files.',
        'We keep the Customer\'s data for 30 days after cancellation and then delete it. Deleted data cannot be restored. Information we must keep by law is retained separately for the required period.',
      ],
    },
    {
      title: '12. Content',
      body: [
        'The Customer (or the original rights holder) keeps all rights in its Content. We handle Content only as needed to provide the Service: storing, displaying, backing up and transmitting it.',
        'The Customer is responsible for what it publishes, including defamation, copyright, privacy, corrections and right-of-reply obligations in its jurisdiction.',
        'We may comply with requests from courts and authorities as required by law.',
      ],
    },
    {
      title: '13. AI features',
      body: [
        'AI drafts are starting points for a reporter to check and edit. AI output can be wrong. The Customer is responsible for fact-checking, editing and the decision to publish.',
        'AI drafts are always saved as drafts; a User must publish them manually.',
        'AI risk review is a drafting aid, not legal advice. The risk rules in the Service are currently tuned to Korean media law; for other jurisdictions treat the output as a general editorial checklist and consult a lawyer for legal questions.',
        'When AI is used, the source text and instructions are sent to our AI providers (Anthropic and Google). We use paid terms under which those providers do not train their models on this data.',
      ],
    },
    {
      title: '14. Third-party material',
      body: ['Press releases and external articles the Service helps collect remain subject to the terms of their publishers (attribution, daily limits and so on). The Customer is responsible for complying with them.'],
    },
    {
      title: '15. Accounts',
      body: [
        'The Customer manages inviting Users, assigning roles and removing departed staff.',
        'Users must not share passwords and must tell us promptly if an account is compromised.',
      ],
    },
    {
      title: '16. Our commitments',
      body: [[
        'We will use reasonable efforts to:',
        'keep the Service available and restore it quickly after incidents',
        'back up data daily and apply security updates',
        'protect personal information as described in the Privacy Policy',
        'respond to support requests promptly',
      ]],
    },
    {
      title: '17. Confidentiality',
      body: [
        'Each party will keep the other\'s non-public business information (pricing, unpublished articles, sources, internal materials) confidential and use it only for the contract, during the term and for 3 years after.',
        'This does not cover information that is public, was already known, or must be disclosed by law or a court order.',
      ],
    },
    {
      title: '18. Customer responsibilities',
      body: [[
        'The Customer and its Users must:',
        'pay fees when due',
        'not resell or sublicense the Service without our consent',
        'not attack the Service or interfere with other customers (including excessive automated requests)',
        'not publish content that violates applicable law',
        'tell us promptly if company or contact details change',
      ]],
    },
    {
      title: '19. Service interruptions',
      body: [
        'We may pause the Service for maintenance with advance notice.',
        'Emergency security work, outages at our cloud providers, force majeure and large-scale attacks can interrupt the Service without notice. We will share the cause and recovery status.',
      ],
    },
    {
      title: '20. Suspension',
      body: [
        'If an invoice is unpaid 5 days after its due date we may restrict newsroom editing, publishing and AI features. Public outlet websites stay online. We lift the restriction as soon as the balance is paid. We do not charge late fees.',
        'If an invoice remains unpaid 30 days after restriction we may terminate. For serious breaches of section 18 we may restrict the Service after notice and terminate if not corrected within 7 days.',
      ],
    },
    {
      title: '21. Service credits and liability',
      body: [
        'If the Service is unavailable for more than 4 consecutive hours because of our fault, we credit 3 times the fees for that time against the next invoice (up to one month\'s fees).',
        `Our total liability under this contract is limited to the fees the Customer actually paid in the 12 months before the claim (excluding the setup fee). This limit does not apply to our intentional misconduct or gross negligence, to bodily injury, or where the law does not permit a limit.`,
        'We are not liable for: losses caused by the Customer or its Users (leaked passwords, accidental deletion); the content of the Customer\'s publications and resulting disputes; outages of services we do not operate (domain registrars, email providers); or lost revenue or profit.',
      ],
    },
    {
      title: '22. Data protection',
      body: [
        'For personal data of readers and Users that the Customer places in the Service, the Customer is the controller and we are the processor. We process it only to provide the Service, apply appropriate security measures, use sub-processors listed in the Privacy Policy under written obligations, notify the Customer without undue delay (and within 72 hours) of a confirmed breach, help the Customer respond to data-subject requests, and return or delete data when the contract ends (section 11).',
        'Where required (for example for customers in the EU, UK or other regions with equivalent rules), we will sign a data-processing agreement on request.',
      ],
    },
    {
      title: '23. Governing law and disputes',
      body: [
        'These Terms are governed by the laws of the State of Texas, USA, without regard to conflict-of-law rules.',
        'The parties will first try to resolve disputes in good faith. Failing that, they submit to the exclusive jurisdiction of the state and federal courts located in Texas, except that either party may seek injunctive relief anywhere.',
      ],
    },
    { title: '24. Contact', body: [`${co()} — ${mail()}${ISSUER.address ? ` — ${ISSUER.address}` : ''}`, `These Terms are effective ${TERMS_EFFECTIVE_EN}.`] },
  ]
}

export function applyConsentSectionsEn(): PolicySection[] {
  return [
    { title: 'Purpose', body: ['Handling your application and consultation, entering into and performing the contract (launch, invoicing, billing), customer support and service notices.'] },
    { title: 'What we collect', body: [['Required: publication name, your name, email, phone, plan and billing choice, country', 'Optional: domain, number of titles, current CMS, notes']] },
    { title: 'Retention', body: ['Applications that do not become a contract are deleted after 1 year. Contract and billing records are kept as long as the law requires. You can refuse consent, but we cannot process an application without it.'] },
  ]
}

export function privacySectionsEn(): PolicySection[] {
  return [
    { title: 'Introduction', body: [`${intro()} operates ${PRODUCT.name}. This policy explains what personal information we collect when you apply for or use the Service (including the newsroom website and the Android app), why, and your choices.`] },
    {
      title: '1. What we collect and why',
      body: [[
        'Application and consultation: publication name, your name, phone, email, plan, country and optional notes. Used to respond to you and set up your contract',
        'Contract and billing: legal name, business registration details if applicable, address, billing contact. Used for invoices and receipts',
        'Newsroom accounts: name, email, outlet and role, and Google account email if you sign in with Google. Used for sign-in, permissions and bylines',
        'Content you upload: articles, photos, videos, files and support requests with attachments. Used to publish and support your newsroom',
        'Automatic information: IP address, browser, sign-in history and cookies needed to keep you signed in. Used for security and troubleshooting',
        'The Android app does not collect location, contacts, call logs or device identifiers',
      ]],
    },
    {
      title: '2. Readers of your publication',
      body: ['If your publication collects reader information through the Service (newsletter sign-ups, tips), you are the controller of that data and we process it on your behalf under section 22 of the Terms.'],
    },
    {
      title: '3. Sub-processors and international transfers',
      body: [[
        'We use the following providers. Your information is processed in the United States, Japan and other locations they operate:',
        'Supabase Inc. (database and file storage; data stored in Tokyo, Japan)',
        'Vercel Inc. (web hosting)',
        'Stripe, Inc. (payment processing; card numbers are held only by Stripe)',
        'Anthropic PBC and Google LLC (AI drafting, only when you use AI features; paid terms, no model training on your data)',
        'Resend, Inc. (transactional and newsletter email delivery)',
      ]],
    },
    { title: '4. Retention', body: ['Account and contract information is kept while the contract is active. After cancellation we delete newsroom data after 30 days (section 11 of the Terms). Billing records are kept for the period required by tax and accounting law. Application records that do not become a contract are deleted after 1 year.'] },
    {
      title: '5. Your rights',
      body: [`You may ask us to access, correct, delete or export your personal information, or object to or restrict its processing, by emailing ${mail()}. If you are in the EU, UK or a region with similar law, you may also lodge a complaint with your local data-protection authority. We do not sell personal information.`],
    },
    { title: '6. Security', body: ['We encrypt data in transit, restrict access by role, offer two-factor authentication, keep sign-in history and take daily backups.'] },
    { title: '7. Contact and changes', body: [`Questions: ${mail()}. We will post changes to this policy here and email customers about material changes. Effective ${TERMS_EFFECTIVE_EN}.`] },
  ]
}
