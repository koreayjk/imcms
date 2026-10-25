import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'

// 광고 화면 위 탭: 배너(홈페이지에 거는 것) / 광고 계약(광고주·금액·기간·입금) / 광고문의(홈페이지 광고문의 양식으로 들어온 글)
export default async function AdTabs({ current, showContracts }: { current: 'banners' | 'contracts' | 'inquiries'; showContracts: boolean }) {
  if (!showContracts) return null
  // 새 광고문의 수 (inquiries.sql 전이면 0). 운영팀은 고객 매체의 문의를 세지 않는다
  const { supabase, outletId, isStaff } = await getCmsContext()
  const { count } = !isStaff && outletId
    ? await supabase.from('site_inquiries').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', 'new')
    : { count: 0 }
  return (
    <nav className="mb-5 flex border-b border-line" aria-label="광고">
      {([['banners', '배너', '/admin/ads'], ['contracts', '광고 계약', '/admin/ads/contracts'], ['inquiries', '광고문의', '/admin/ads/inquiries']] as const).map(([k, label, href]) => (
        <Link key={k} href={href} aria-current={current === k ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${current === k ? 'border-ink font-bold' : 'border-transparent text-muted hover:text-ink'}`}>
          {label}
          {k === 'inquiries' && !!count && <span className="ml-1.5 rounded-full bg-danger px-1.5 py-0.5 align-middle text-[11px] font-bold text-white">{count}</span>}
        </Link>
      ))}
    </nav>
  )
}
