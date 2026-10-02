import type { Metadata } from 'next'
import { PRODUCT } from '@/lib/product'
import { termsSections } from '@/lib/service-terms'
import PolicyPageShell from '@/components/product/PolicyPageShell'

export const metadata: Metadata = { title: `서비스 이용약관 — ${PRODUCT.name}` }

export default function TermsPage() {
  return <PolicyPageShell title="서비스 이용약관" sections={termsSections()} other={{ href: `${PRODUCT.path}/privacy`, label: '개인정보처리방침' }} />
}
