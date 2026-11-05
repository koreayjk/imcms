// 2026-10-21 판 영문 서비스 이용약관 (고객이 그때 동의한 문안 그대로. 고치지 않는다). 영문 약관에는 예전 약관 화면이 아직 없어 기록용으로만 둔다
import type { PolicySection } from '../service-terms'

export const TERMS_EN_2026_10_21: PolicySection[] = [
  {
    "title": "1. Purpose",
    "body": [
      "These Terms govern how a news organization (the \"Customer\") uses IM 뉴스룸, a cloud newsroom and website service provided by IM America Group Corp (doing business as IM Genesis) (\"we\", \"us\", the \"Company\"). By submitting an application or using the service you agree to them on behalf of the Customer."
    ]
  },
  {
    "title": "2. Definitions",
    "body": [
      [
        "Service means the newsroom tools, publishing, AI drafting and review, press-release intake, outlet websites and support provided by the Company over the web",
        "Customer means the organization or publisher that signs up for the Service",
        "Users means the publishers, editors and reporters the Customer invites to sign in",
        "Content means articles, photos, videos and files the Customer and its Users upload to the Service",
        "Plan means a plan and its limits and price as published on the pricing page"
      ]
    ]
  },
  {
    "title": "3. Changes to these Terms",
    "body": [
      "We may update these Terms. We will post the new version and email the Customer's contact at least 7 days before it takes effect (30 days if the change is unfavorable to the Customer).",
      "If the Customer does not agree to a change, it may cancel before the effective date without penalty. Continuing to use the Service after that date means the Customer accepts the change."
    ]
  },
  {
    "title": "4. Applying and acceptance",
    "body": [
      "The Customer applies through the application form. We may ask for business documents needed for the contract.",
      [
        "We may decline an application, or later terminate the contract, if:",
        "the applicant used another person's or company's identity",
        "the application contains false information",
        "the applicant previously left unpaid fees to us",
        "the Service would be used for unlawful purposes"
      ]
    ]
  },
  {
    "title": "5. The Service",
    "body": [
      "What each Plan includes (AI uses, storage, banner and popup design requests, newsletter allowances and so on) is as published on the pricing page. We do not cap bandwidth for normal newsroom use.",
      "We may add or change features to improve the Service. We will give notice before removing or substantially changing a feature the Customer relies on."
    ]
  },
  {
    "title": "6. Onboarding and domain",
    "body": [
      "After confirming the application, we tell the Customer about the launch schedule and the materials we need (logo, legal/footer information, domain) and start the launch work, such as opening the newsroom and site and connecting the domain. The launch date is the day the site goes live, and the first invoice is issued on that date. We do not charge fees or the setup fee before launch.",
      "A delay in providing materials may delay the launch.",
      "The Customer owns its domain and is responsible for renewing it. We provide the DNS settings needed to connect it."
    ]
  },
  {
    "title": "7. Moving existing content",
    "body": [
      "On request we will help move existing articles and photos from the Customer's previous system and set up redirects from old article addresses where feasible. Scope and timing depend on the source format and are agreed in advance.",
      "Some formatting may differ from the original after a move. The Customer reviews the result."
    ]
  },
  {
    "title": "8. Fees and payment",
    "body": [
      "Fees are as published on the pricing page, in US dollars. Prices are final prices; we do not add Korean VAT. Where required by law, sales, use, GST or similar taxes in the Customer's jurisdiction are the Customer's responsibility.",
      "Fees are paid in advance. The first invoice is issued on the launch date and is due by the date shown on it (usually two weeks after issue). After that we issue an invoice at the start of each billing period and the Customer pays by its due date. Annual billing covers 12 months and is charged as 11 months' fees.",
      "The one-time setup fee is $110 and covers opening the newsroom and site, customization, domain connection, content migration support and onboarding. It is waived for customers who apply before October 31, 2026. Waiver is conditional on at least 3 months of use from launch (see section 10).",
      "Customers who apply before October 31, 2026 receive 50% off the plan fee for the first 3 months. Extra publications ($65/month each beyond those included in Premium) and extra AI usage ($8 per 100 uses) are not discounted.",
      "Payments are processed by Stripe. We do not store card numbers. We give 30 days' notice before raising prices and apply the new price only with the Customer's acceptance or after the notice period if the Customer continues to use the Service."
    ]
  },
  {
    "title": "9. Usage limits",
    "body": [
      "If AI usage exceeds the monthly allowance the Customer may buy 100 more uses for $8 or wait until next month. We notify the Customer before the limit is reached.",
      "If storage exceeds the Plan or bandwidth is far above typical newsroom use for several months, we will contact the Customer to agree on a suitable Plan. We will not bill for temporary spikes the Customer did not cause (for example automated attacks)."
    ]
  },
  {
    "title": "10. Cancellation and refunds",
    "body": [
      "The Customer may cancel at any time by contacting contact@imnewsroom.com or through the in-app support request.",
      "Monthly billing: the Customer keeps access through the end of the month in which it cancels. Fees for that month are not refunded. Fees prepaid for later months are refunded.",
      "Annual billing: we refund the amount paid minus the months used at the monthly rate (with the same discount). The 1-month-free benefit applies only if the full year is used.",
      "If the Customer cancels its application before the launch date, we do not charge fees or the setup fee. Setup fee: not refundable after launch. If the setup fee was waived and the Customer cancels within 3 months of launch, we may charge the waived setup fee ($110) and deduct it from any refund. It is not charged after 3 months, or if the Customer cancels because of our breach or because we end the Service.",
      "If we end the Service or the Customer cancels because of our breach, we refund all prepaid fees for the remaining period."
    ]
  },
  {
    "title": "11. Your data after cancellation",
    "body": [
      "On request we provide the Customer's articles and photos as downloadable files.",
      "We keep the Customer's data for 30 days after cancellation and then delete it. Deleted data cannot be restored. Information we must keep by law is retained separately for the required period."
    ]
  },
  {
    "title": "12. Content",
    "body": [
      "The Customer (or the original rights holder) keeps all rights in its Content. We handle Content only as needed to provide the Service: storing, displaying, backing up and transmitting it.",
      "The Customer is responsible for what it publishes, including defamation, copyright, privacy, corrections and right-of-reply obligations in its jurisdiction.",
      "We may comply with requests from courts and authorities as required by law."
    ]
  },
  {
    "title": "13. AI features",
    "body": [
      "AI drafts are starting points for a reporter to check and edit. AI output can be wrong. The Customer is responsible for fact-checking, editing and the decision to publish.",
      "AI drafts are always saved as drafts; a User must publish them manually.",
      "AI risk review is a drafting aid, not legal advice. The risk rules in the Service are currently tuned to Korean media law; for other jurisdictions treat the output as a general editorial checklist and consult a lawyer for legal questions.",
      "When AI is used, the source text and instructions are sent to our AI providers (Anthropic and Google). We use paid terms under which those providers do not train their models on this data."
    ]
  },
  {
    "title": "14. Third-party material",
    "body": [
      "Press releases and external articles the Service helps collect remain subject to the terms of their publishers (attribution, daily limits and so on). The Customer is responsible for complying with them."
    ]
  },
  {
    "title": "15. Accounts",
    "body": [
      "The Customer manages inviting Users, assigning roles and removing departed staff.",
      "Users must not share passwords and must tell us promptly if an account is compromised."
    ]
  },
  {
    "title": "16. Our commitments",
    "body": [
      [
        "We will use reasonable efforts to:",
        "keep the Service available and restore it quickly after incidents",
        "back up data daily and apply security updates",
        "protect personal information as described in the Privacy Policy",
        "respond to support requests promptly"
      ]
    ]
  },
  {
    "title": "17. Confidentiality",
    "body": [
      "Each party will keep the other's non-public business information (pricing, unpublished articles, sources, internal materials) confidential and use it only for the contract, during the term and for 3 years after.",
      "This does not cover information that is public, was already known, or must be disclosed by law or a court order."
    ]
  },
  {
    "title": "18. Customer responsibilities",
    "body": [
      [
        "The Customer and its Users must:",
        "pay fees when due",
        "not resell or sublicense the Service without our consent",
        "not attack the Service or interfere with other customers (including excessive automated requests)",
        "not publish content that violates applicable law",
        "tell us promptly if company or contact details change"
      ]
    ]
  },
  {
    "title": "19. Service interruptions",
    "body": [
      "We may pause the Service for maintenance with advance notice.",
      "Emergency security work, outages at our cloud providers, force majeure and large-scale attacks can interrupt the Service without notice. We will share the cause and recovery status."
    ]
  },
  {
    "title": "20. Suspension",
    "body": [
      "If an invoice is unpaid 5 days after its due date we may restrict newsroom editing, publishing and AI features. Public outlet websites stay online. We lift the restriction as soon as the balance is paid. We do not charge late fees.",
      "If an invoice remains unpaid 30 days after restriction we may terminate. For serious breaches of section 18 we may restrict the Service after notice and terminate if not corrected within 7 days."
    ]
  },
  {
    "title": "21. Service credits and liability",
    "body": [
      "If the Service is unavailable for more than 4 consecutive hours because of our fault, we credit 3 times the fees for that time against the next invoice (up to one month's fees).",
      "Our total liability under this contract is limited to the fees the Customer actually paid in the 12 months before the claim (excluding the setup fee). This limit does not apply to our intentional misconduct or gross negligence, to bodily injury, or where the law does not permit a limit.",
      "We are not liable for: losses caused by the Customer or its Users (leaked passwords, accidental deletion); the content of the Customer's publications and resulting disputes; outages of services we do not operate (domain registrars, email providers); or lost revenue or profit."
    ]
  },
  {
    "title": "22. Data protection",
    "body": [
      "For personal data of readers and Users that the Customer places in the Service, the Customer is the controller and we are the processor. We process it only to provide the Service, apply appropriate security measures, use sub-processors listed in the Privacy Policy under written obligations, notify the Customer without undue delay (and within 72 hours) of a confirmed breach, help the Customer respond to data-subject requests, and return or delete data when the contract ends (section 11).",
      "Where required (for example for customers in the EU, UK or other regions with equivalent rules), we will sign a data-processing agreement on request."
    ]
  },
  {
    "title": "23. Governing law and disputes",
    "body": [
      "These Terms are governed by the laws of the State of Texas, USA, without regard to conflict-of-law rules.",
      "The parties will first try to resolve disputes in good faith. Failing that, they submit to the exclusive jurisdiction of the state and federal courts located in Texas, except that either party may seek injunctive relief anywhere."
    ]
  },
  {
    "title": "24. Contact",
    "body": [
      "IM America Group Corp — contact@imnewsroom.com — 1608 Hollow Hill Dr, Apt 912, Bryan, TX 77802, USA",
      "These Terms are effective October 21, 2026."
    ]
  }
]
