import Link from 'next/link'
import { PRODUCT } from '@/lib/product'
import { TERMS_EFFECTIVE, type PolicySection } from '@/lib/service-terms'
import PolicyDoc from './PolicyDoc'

// IM 뉴스룸 소개 사이트의 약관·방침 전문 페이지 틀
export default function PolicyPageShell({ title, sections, other }: { title: string; sections: PolicySection[]; other: { href: string; label: string } }) {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#14171C]">
      <header className="border-b border-[#E4E6EA] bg-white">
        <div className="mx-auto flex max-w-[860px] items-center justify-between px-4 py-4 sm:px-6">
          <Link href={PRODUCT.path} className="text-[15px] font-extrabold tracking-[-0.02em]">← {PRODUCT.name}</Link>
          <Link href={other.href} className="text-[13.5px] text-[#5B616B] hover:text-[#14171C]">{other.label}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[860px] px-4 py-12 sm:px-6">
        <h1 className="text-[30px] font-extrabold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[14px] text-[#5B616B]">시행일 {TERMS_EFFECTIVE}</p>
        <article className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-black/5 sm:p-10">
          <PolicyDoc sections={sections} />
        </article>
      </main>
    </div>
  )
}
