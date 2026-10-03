import Link from 'next/link'
import { GDPA } from '@/lib/gdpa'

export default function GdpaFooter({ base }: { base: string }) {
  const o = GDPA.office
  return (
    <footer className="mt-20 bg-[var(--g-navy-d)] text-[13px] text-white/65">
      <div className="border-b border-white/10">
        <nav aria-label="정책" className="mx-auto flex max-w-[1200px] flex-wrap gap-x-6 gap-y-2 px-4 py-4 text-white/85">
          <Link href={`${base}/terms`} className="hover:text-white">이용약관</Link>
          <Link href={`${base}/privacy`} className="font-bold text-white hover:underline">개인정보처리방침</Link>
          <Link href={`${base}/email-policy`} className="hover:text-white">이메일무단수집거부</Link>
          <Link href={`${base}/about/contact`} className="hover:text-white">오시는 길·문의</Link>
        </nav>
      </div>
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-8 md:grid-cols-[auto_1fr]">
        <img src="/gdpa/logo-full-white.svg" alt={`${GDPA.short} ${GDPA.name}`} className="h-[46px] w-auto" />
        <div className="space-y-1 leading-relaxed md:pl-6">
          <p><strong className="text-white">{GDPA.name}</strong> ({GDPA.nameEn})</p>
          <p>주소 {o.address || '준비 중'} · 전화 {o.phone || '준비 중'} · 이메일 {o.email || '준비 중'}</p>
          <p className="pt-2 text-white/45">© {GDPA.founded} {GDPA.short} {GDPA.nameEn}. 이 홈페이지의 글·사진은 저작권법의 보호를 받으며, 회원사 기사의 저작권은 각 회원사에 있습니다.</p>
        </div>
      </div>
    </footer>
  )
}
