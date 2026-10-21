import type { Metadata } from 'next'
import { TERMS_EFFECTIVE_EN, termsSectionsEn } from '@/lib/service-terms-en'
import PolicyPageShell from '@/components/product/PolicyPageShell'

export const metadata: Metadata = { title: 'Terms of Service — IM Newsroom' }

export default function TermsPageEn() {
  return <PolicyPageShell en title="Terms of Service" sections={termsSectionsEn()} effective={TERMS_EFFECTIVE_EN} other={{ href: '/imnewsroom/en/privacy', label: 'Privacy Policy' }} />
}
