'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/support', label: '고객센터 홈', exact: true },
  { href: '/support/tickets', label: '업무요청' },
  { href: '/support/notices', label: '공지' },
  { href: '/support/invoices', label: '청구서', billing: true },
  { href: '/support/billing', label: '결제 정보', billing: true },
  { href: '/support/help', label: '이용안내' },
]

export default function SupportNav({ canBilling }: { canBilling: boolean }) {
  const path = usePathname()
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="고객센터 메뉴">
      {ITEMS.filter((i) => canBilling || !i.billing).map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href)
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3.5 text-[14.5px] ${active ? 'border-[#E5483A] font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
