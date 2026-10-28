import Link from 'next/link'

// 설정 화면 위의 탭: 매체 정보 / AI·이메일 / 포털 제휴 (포털 제휴는 따로 열리는 화면이지만 같은 설정 안에서 보이게 한다)
export default function SettingsTabs({ active, t }: { active: 'site' | 'ai' | 'portal'; t: (ko: string, en: string) => string }) {
  const tabs = [
    { key: 'site', href: '/admin/settings?tab=site', label: t('매체 정보', 'Outlet info') },
    { key: 'ai', href: '/admin/settings?tab=ai', label: t('AI·이메일', 'AI & email') },
    { key: 'portal', href: '/admin/portal', label: t('포털 제휴', 'Portals') },
  ] as const
  return (
    <nav className="mt-3 flex gap-1 border-b border-line text-[14px]" aria-label={t('설정 구역', 'Settings sections')}>
      {tabs.map((x) => (
        <Link key={x.key} href={x.href} aria-current={active === x.key ? 'page' : undefined} className={`-mb-px border-b-2 px-4 py-2 font-semibold ${active === x.key ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'}`}>{x.label}</Link>
      ))}
    </nav>
  )
}
