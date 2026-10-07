import Link from 'next/link'

// 광고 화면 위 탭: 배너(홈페이지에 거는 것) / 광고 계약(광고주·금액·기간·입금)
export default function AdTabs({ current, showContracts }: { current: 'banners' | 'contracts'; showContracts: boolean }) {
  if (!showContracts) return null
  return (
    <nav className="mb-5 flex border-b border-line" aria-label="광고">
      {([['banners', '배너', '/admin/ads'], ['contracts', '광고 계약', '/admin/ads/contracts']] as const).map(([k, label, href]) => (
        <Link key={k} href={href} aria-current={current === k ? 'page' : undefined}
          className={`-mb-px border-b-2 px-4 py-2.5 text-[14px] ${current === k ? 'border-ink font-bold' : 'border-transparent text-muted hover:text-ink'}`}>{label}</Link>
      ))}
    </nav>
  )
}
