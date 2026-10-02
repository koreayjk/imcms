import type { Metadata } from 'next'
import { PRODUCT } from '@/lib/product'
import { privacySections } from '@/lib/service-terms'
import PolicyPageShell from '@/components/product/PolicyPageShell'

export const metadata: Metadata = { title: `개인정보처리방침 — ${PRODUCT.name}` }

export default function PrivacyPage() {
  return <PolicyPageShell title="개인정보처리방침" sections={privacySections()} other={{ href: `${PRODUCT.path}/terms`, label: '서비스 이용약관' }} />
}
