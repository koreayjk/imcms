import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PRODUCT } from '@/lib/product'
import { TERMS_EFFECTIVE } from '@/lib/service-terms'
import { TERMS_HISTORY } from '@/lib/terms-archive'
import PolicyPageShell from '@/components/product/PolicyPageShell'

// 예전 이용약관 (그 버전에 동의한 고객사가 그때 문안을 볼 수 있게)
export async function generateMetadata(props: { params: Promise<{ version: string }> }): Promise<Metadata> {
  const { version } = await props.params
  return { title: `서비스 이용약관 (${version} 판) — ${PRODUCT.name}`, robots: { index: false } }
}

export default async function OldTermsPage(props: { params: Promise<{ version: string }> }) {
  const { version } = await props.params
  const old = TERMS_HISTORY[version]
  if (!old) notFound()
  return (
    <PolicyPageShell
      title={`서비스 이용약관 (${version} 판)`}
      sections={old.sections}
      effective={old.effective}
      other={{ href: `${PRODUCT.path}/terms`, label: '지금 약관 보기' }}
      note={<p className="mt-3 rounded-lg bg-[#FFF7E6] px-4 py-3 text-[13.5px] text-[#7A4B00]">예전 약관입니다. 지금 약관은 {TERMS_EFFECTIVE}부터 시행 중이며 <Link href={`${PRODUCT.path}/terms`} className="font-semibold underline underline-offset-2">여기</Link>에서 볼 수 있습니다.</p>}
    />
  )
}
