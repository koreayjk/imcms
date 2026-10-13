import type { Metadata } from 'next'
import Link from 'next/link'
import { PRODUCT } from '@/lib/product'
import { termsSections } from '@/lib/service-terms'
import { TERMS_HISTORY } from '@/lib/terms-archive'
import PolicyPageShell from '@/components/product/PolicyPageShell'

export const metadata: Metadata = { title: `서비스 이용약관 — ${PRODUCT.name}` }

export default function TermsPage() {
  const old = Object.entries(TERMS_HISTORY)
  return (
    <PolicyPageShell
      title="서비스 이용약관"
      sections={termsSections()}
      other={{ href: `${PRODUCT.path}/privacy`, label: '개인정보처리방침' }}
      footer={old.length ? (
        <p className="mt-6 text-[13.5px] text-[#5B616B]">
          예전 약관: {old.map(([v, o], i) => <span key={v}>{i ? ' · ' : ''}<Link href={`${PRODUCT.path}/terms/${v}`} className="underline underline-offset-2 hover:text-[#14171C]">{o.effective} 판</Link></span>)}
        </p>
      ) : null}
    />
  )
}
