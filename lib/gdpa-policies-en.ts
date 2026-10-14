// 글로벌디지털언론협회(GDPA) 이용약관·개인정보처리방침·회원가입 동의 — 영문판 (한국어판이 우선)
//   lib/gdpa-policies.ts 와 같은 구조(조항 수·순서·본문 모양)를 지킨다. 한국어판을 고치면 여기도 함께 고친다
import { GDPA } from './gdpa'
import type { PolicySection } from './service-terms'
import type { GDPA_PROCESSORS, GDPA_SIGNUP_CONSENT } from './gdpa-policies'

export type { PolicySection }

const ASSOC = `the ${GDPA.nameEn} ("${GDPA.short}" or the "Association")`
const ASSOC_CAP = `The ${GDPA.nameEn} ("${GDPA.short}" or the "Association")`
const TRANSLATION_NOTICE =
  'This English version is provided for convenience. If there is any conflict between this version and the Korean version, the Korean version prevails.'
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const effective = () => {
  const [y, m, d] = GDPA.policyDate.split('-').map(Number)
  return `${MONTHS[m - 1]} ${d}, ${y}`
}
const officeContact = () =>
  [GDPA.office.email && `email ${GDPA.office.email}`, GDPA.office.phone && `phone ${GDPA.office.phone}`].filter(Boolean).join(', ') ||
  'the Secretariat contact details listed under "Contact" on this website'
// 직함은 lib/gdpa.ts 에 한국어로 들어 있다
const POSITION_EN: Record<string, string> = { 사무국장: 'Secretary General' }
const positionEn = (p: string) => POSITION_EN[p] ?? p

// 개인정보를 맡겨 처리하거나 국외에서 처리하는 곳
export const GDPA_PROCESSORS_EN: typeof GDPA_PROCESSORS = [
  { name: 'Supabase Inc.', country: 'US company · data stored in Japan (Tokyo)', what: 'Storing member information and handling sign-in (passwords are stored in encrypted form)', items: 'All information provided at sign-up' },
  { name: 'Vercel Inc.', country: 'US company · processed in Japan (Tokyo) and Korea (Seoul)', what: 'Operating the website servers', items: 'Information exchanged while using the website; access logs' },
  { name: 'Resend, Inc.', country: 'United States', what: 'Sending sign-up confirmation and notification emails', items: 'Email address, name, email content' },
]

// ───────── Terms of Use ─────────
export function gdpaTermsSectionsEn(): PolicySection[] {
  return [
    {
      title: 'Article 1 (Purpose)',
      body: [
        TRANSLATION_NOTICE,
        `The purpose of these Terms of Use is to set out the conditions and procedures for using the services provided on the website operated by ${ASSOC} (the "Website"), and the rights, obligations and responsibilities of the Association and its members.`,
      ],
    },
    {
      title: 'Article 2 (Definitions)',
      body: [[
        `"Services" means all services that the Association provides through the Website, including information about the Association, news from member organizations, notices and the resource library, information on events and training, and members-only information.`,
        `"Member" means a person who has agreed to these Terms, applied for membership and been approved by the Association. Members are divided into individual members and member organization (media outlet) members.`,
        `"Member Organization" means a media outlet (such as an online newspaper) that has joined the Association through its admission procedure.`,
        `"ID (email)" and "Password" mean the email address and the combination of letters and numbers that a member has chosen for signing in.`,
      ]],
    },
    {
      title: 'Article 3 (Posting and Amendment of the Terms)',
      body: [
        `The Association posts these Terms at the bottom of the Website's home page or on the sign-up page.`,
        'The Association may amend these Terms to the extent that doing so does not violate applicable laws. When it does so, it will announce the effective date and the changes on the Website from 7 days before the effective date (or from 30 days before, if the changes are unfavorable to members).',
        'Members who do not agree to the amended Terms may withdraw their membership. Members who continue to use the Services after the effective date are deemed to have agreed to the amended Terms.',
      ],
    },
    {
      title: 'Article 4 (Membership Registration)',
      body: [
        'Membership is established when a user agrees to these Terms and to the collection and use of personal information, completes the application form, and the Association approves the application.',
        [
          'The Association may refuse to approve any of the following applications, and may revoke membership even after approval:',
          `The applicant has used another person's name or email address, or has provided false information in the application`,
          'The applicant is under 14 years of age',
          'The applicant has previously lost membership (unless the Association has approved re-registration)',
          `The application otherwise conflicts with the Association's founding purposes or is likely to cause harm to other members`,
        ],
        `Admission of member organization (media outlet) members may be subject to a separate review in accordance with the Association's Articles of Association and admission rules.`,
      ],
    },
    {
      title: 'Article 5 (Changes to and Management of Member Information)',
      body: [
        'Members can view and correct their information under "My Account" on the Website, and must correct it promptly if any of the details provided at sign-up change.',
        'Members are responsible for managing their ID (email) and password and must not allow anyone else to use them. A member who becomes aware of unauthorized use must notify the Association immediately.',
      ],
    },
    {
      title: 'Article 6 (Obligations of the Association)',
      body: [
        'The Association complies with applicable laws and these Terms and endeavors to provide the Services reliably.',
        `The Association protects members' personal information in accordance with its Privacy Policy and does not provide it to third parties without the member's consent, except as provided by law.`,
        `If the Association recognizes that a member's opinion or complaint is justified, it will deal with it promptly and inform the member of the outcome.`,
      ],
    },
    {
      title: 'Article 7 (Obligations of Members)',
      body: [[
        'Members must not engage in any of the following acts:',
        `Misappropriating another person's information or registering false information`,
        'Defaming the Association or a third party, or interfering with their business',
        'Infringing the copyright or other intellectual property rights of the Association or a third party',
        'Posting or distributing obscene or violent content, content that promotes hatred, or illegal advertising',
        `Using the Services for commercial purposes without the Association's permission, or interfering with the operation of the Services`,
        `Any other act that violates applicable laws or the Association's Articles of Association`,
      ]],
    },
    {
      title: 'Article 8 (Provision, Change and Suspension of the Services)',
      body: [
        'In principle, the Services are available 24 hours a day, every day of the year. However, the Association may suspend the Services temporarily for unavoidable reasons such as system maintenance or replacement, or communication failures, and will give notice in advance (or afterwards, in an emergency).',
        'The Association may change the content of the Services or discontinue part of them where necessary for operational reasons, and will announce this on the Website.',
      ],
    },
    {
      title: 'Article 9 (Management of Posts and Copyright)',
      body: [
        `Copyright in the Association's text, photographs and materials published on the Website belongs to the Association or the original author, and copyright in member organizations' articles belongs to each member organization. They may not be reproduced, distributed, transmitted or modified without permission.`,
        'Copyright in posts that members upload to the Website belongs to their authors. However, the Association may hide or delete, without prior notice, any post that violates applicable laws or these Terms.',
      ],
    },
    {
      title: 'Article 10 (Withdrawal and Loss of Membership)',
      body: [
        `Members may ask to withdraw from the Association at any time (using ${officeContact()}), and the Association will process the request promptly in accordance with applicable laws.`,
        `If it is confirmed that a member has violated Article 7 or falls under Article 4(2), the Association may restrict or revoke the member's membership after giving the member an opportunity to explain within a set period.`,
        `The financial obligations of member organizations, such as membership dues and admission fees, are governed by the Association's Articles of Association and separate regulations.`,
      ],
    },
    {
      title: 'Article 11 (Limitation of Liability)',
      body: [
        `The Association is not liable for damage caused by natural disasters, by reasons attributable to the member, or by the acts of third parties beyond the Association's control.`,
        `The Association does not guarantee the accuracy of information written by third parties, such as member organizations' articles; responsibility for such content lies with the member organization or author who wrote it.`,
        'The Association is not liable in connection with the use of Services provided free of charge, unless applicable laws specifically provide otherwise.',
      ],
    },
    {
      title: 'Article 12 (Dispute Resolution)',
      body: [
        'The Association and members will consult in good faith to resolve any dispute relating to the Services amicably.',
        'Any dispute that is not resolved through consultation is governed by the laws of the Republic of Korea and will be settled by the competent court under the Civil Procedure Act.',
      ],
    },
    { title: 'Supplementary Provision', body: [`These Terms take effect on ${effective()}.`] },
  ]
}

// ───────── Privacy Policy ─────────
export function gdpaPrivacySectionsEn(): PolicySection[] {
  const officer = GDPA.privacyOfficer
  return [
    {
      title: 'Overview',
      body: [
        TRANSLATION_NOTICE,
        `${ASSOC_CAP} complies with the Personal Information Protection Act and other applicable laws and treats members' personal information with care. This Policy explains what personal information the Association collects on its website and why, how long it keeps it, and how it protects it.`,
      ],
    },
    {
      title: '1. Personal Information We Collect',
      body: [
        ['Membership registration', 'Required: name, email (ID), password, mobile phone number, membership type (individual or member organization)', 'Optional: affiliation (company or media outlet name), job title, and whether the member agrees to receive information about events and training'],
        ['Information generated automatically', 'Access logs (IP address, browser type, time of access) and cookies that keep members signed in'],
        `Passwords are stored in encrypted form and cannot be viewed even by the Association's Secretariat.`,
      ],
    },
    {
      title: '2. Purposes of Use',
      body: [[
        'Verifying members, approving registrations, and providing sign-in and member services',
        'Reviewing admission applications from member organizations (media outlets) and managing member organizations',
        'Sending notices needed to run the Association, such as announcements, news of Association activities and general meetings',
        'Responding to inquiries, handling complaints and preventing misuse',
        '(Where the optional consent has been given) Sending information about events, training and awards',
      ]],
    },
    {
      title: '3. Retention Period and Destruction',
      body: [
        'Member information is kept until the member withdraws and is destroyed without delay upon withdrawal.',
        ['However, the following information is kept for the periods prescribed by the relevant laws:', 'Website access logs: 3 months (Protection of Communications Secrets Act)', 'Records of payments, such as membership dues, and of the supply of goods: 5 years; records of complaint and dispute handling: 3 years (Act on the Consumer Protection in Electronic Commerce, where applicable)'],
        'Electronic files are deleted using methods that make them unrecoverable, and paper documents are shredded or incinerated.',
      ],
    },
    { title: '4. Provision to Third Parties', body: ['The Association does not provide personal information to third parties unless the member has consented or the law specifically provides otherwise.'] },
    { title: '5. Outsourcing of Processing and Overseas Transfer', body: ['To operate the Website, the Association entrusts the processing of personal information to the service providers listed below, which are located outside Korea. Information is transmitted over encrypted connections when members sign up for and use the Website, and is kept for the retention periods described above. Anyone who does not wish their information to be transferred overseas may choose not to sign up, or may withdraw their membership; in that case, member services will not be available.', '__processors__'] },
    {
      title: `6. Members' Rights and How to Exercise Them`,
      body: [
        'Members may at any time request access to, correction or deletion of their personal information, or suspension of its processing, and may withdraw their consent (by withdrawing their membership).',
        `Members can do this themselves under "My Account" on the Website, or by making a request to the Secretariat (using ${officeContact()}); requests will be handled without delay.`,
        'Children under 14 years of age may not register as members.',
      ],
    },
    {
      title: '7. Measures to Protect Personal Information',
      body: [[
        'Encrypted storage of passwords and encrypted communication (HTTPS) over every connection',
        'Limiting the people who can access personal information to the responsible Secretariat staff, and managing access rights',
        'Retention of access logs and regular inspections',
      ]],
    },
    { title: '8. Cookies', body: ['The Website uses cookies to keep members signed in. Cookies can be refused in browser settings, but in that case services that require signing in cannot be used.'] },
    {
      title: '9. Privacy Officer',
      body: [
        `Privacy Officer: ${officer.name || '(to be designated)'} ${officer.position ? `· ${positionEn(officer.position)}` : ''}`.trim(),
        `Contact: ${officer.email || officeContact()}`,
        `Reports and consultations about infringements of personal information can also be made to the Personal Information Infringement Report Center (118, no area code needed; privacy.kisa.or.kr), the Personal Information Dispute Mediation Committee (1833-6972, www.kopico.go.kr), the Supreme Prosecutors' Office (1301, no area code needed) and the Korean National Police Agency (182, no area code needed).`,
      ],
    },
    { title: '10. Changes to This Policy', body: [`This Policy takes effect on ${effective()}. If its contents change, the changes will be announced on the Website from 7 days before they take effect.`] },
  ]
}

// ───────── Sign-up page: consent to the collection and use of personal information (summary) ─────────
export const GDPA_SIGNUP_CONSENT_EN: typeof GDPA_SIGNUP_CONSENT = {
  required: [
    ['Information collected', 'Name, email (ID), password, mobile phone number, membership type / Optional: affiliation, job title'],
    ['Purposes', `Verifying members and approving registrations, providing member services, sending notices about the Association's operations, responding to inquiries`],
    ['Retention period', 'Until you withdraw your membership (information that must be kept by law is kept for the period required)'],
    ['Overseas processing', 'Member information is processed on the servers of overseas service providers such as Supabase (stored in Tokyo, Japan), Vercel and Resend'],
    ['Right to refuse', 'You may refuse to consent, but if you do, you will not be able to sign up'],
  ] as [string, string][],
  marketing: 'Receive information about events, training and awards by email and text message. (Optional: you can sign up without agreeing and can turn this off at any time.)',
}
