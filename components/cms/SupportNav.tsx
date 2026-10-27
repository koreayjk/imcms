'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useT } from '@/components/cms/CmsLang'

// label: 한국어 / en: 영어
const ITEMS = [
  { href: '/support', label: '고객센터 홈', en: 'Support home', exact: true },
  { href: '/support/tickets', label: '업무요청', en: 'Support requests' },
  { href: '/support/notices', label: '공지', en: 'Notices' },
  { href: '/support/invoices', label: '청구서', en: 'Invoices', billing: true },
  { href: '/support/billing', label: '결제 정보', en: 'Billing info', billing: true },
  { href: '/support/guide', label: '기사 작성 가이드', en: 'Story writing guide' },
  { href: '/support/help', label: '이용안내', en: 'Help & guides' },
]

export default function SupportNav({ canBilling }: { canBilling: boolean }) {
  const path = usePathname()
  const t = useT()
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label={t('고객센터 메뉴', 'Support menu')}>
      {ITEMS.filter((i) => canBilling || !i.billing).map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href)
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3.5 text-[14.5px] ${active ? 'border-[#E5483A] font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t(i.label, i.en)}
          </Link>
        )
      })}
    </nav>
  )
}
