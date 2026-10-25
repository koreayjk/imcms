import { liveBanners, type AdSlotId } from '@/lib/ads'
import type { SiteConfig } from '@/lib/sites'
import AdBannerView from './AdBannerView'
import AdPopup from './AdPopup'

// 광고 자리. 지금 나가는 배너가 없으면 아무것도 그리지 않는다
export default async function AdArea({ site, slot, className = '' }: { site: SiteConfig; slot: AdSlotId; className?: string }) {
  // 편집장이 끈 자리는 그리지 않는다
  if ((site.adSlots?.off ?? []).includes(slot)) return null
  const all = await liveBanners(site.outletId, slot)
  // 오른쪽 광고 개수 (기본 3개까지)
  const banners = slot === 'sidebar' ? all.slice(0, site.adSlots?.sidebarMax ?? 3) : all
  if (!banners.length) return null
  if (slot === 'popup') return <AdPopup banner={banners[0]} lang={site.lang} />
  return (
    <div className={`space-y-3 ${className}`} data-ad-slot={slot}>
      {banners.map((b) => <AdBannerView key={b.id} banner={b} lang={site.lang} />)}
    </div>
  )
}
