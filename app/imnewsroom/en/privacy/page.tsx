import type { Metadata } from 'next'
import { PRIVACY_EFFECTIVE_EN, privacySectionsEn } from '@/lib/service-terms-en'
import PolicyPageShell from '@/components/product/PolicyPageShell'

export const metadata: Metadata = { title: 'Privacy Policy — IM Newsroom' }

export default function PrivacyPageEn() {
  return <PolicyPageShell en title="Privacy Policy" sections={privacySectionsEn()} effective={PRIVACY_EFFECTIVE_EN} other={{ href: '/imnewsroom/en/terms', label: 'Terms of Service' }} />
}
