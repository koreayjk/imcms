import type { Metadata } from 'next'
import { GDPA } from '@/lib/gdpa'

export const metadata: Metadata = { title: '이메일무단수집거부' }

export default function Page() {
  return (
    <div className="mx-auto max-w-[860px] px-4 py-14">
      <h1 className="text-[28px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">이메일무단수집거부</h1>
      <p className="mt-8 text-[16px] leading-[1.9]">이 홈페이지에 실린 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치로 무단 수집되는 것을 거부합니다. 이를 어기면 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 따라 처벌받을 수 있습니다.</p>
      <p className="mt-4 text-[14px] text-[var(--g-sub)]">{GDPA.name} · 게시일 {GDPA.policyDate}</p>
    </div>
  )
}
