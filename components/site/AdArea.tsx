import { liveBanners, type AdSlotId } from '@/lib/ads'
import type { SiteConfig } from '@/lib/sites'
import AdBannerView from './AdBannerView'
import AdPopup from './AdPopup'

// 광고 자리. 지금 나가는 배너가 없으면 아무것도 그리지 않는다
// wing: 넓은 화면의 본문 옆 여백에 띄우는 오른쪽 광고 (SiteFrame). 이때 오른쪽 칸의 같은 광고는 넓은 화면에서 숨긴다
export default async function AdArea({ site, slot, className = '', wing = false }: { site: SiteConfig; slot: AdSlotId; className?: string; wing?: boolean }) {
  // 편집장이 끈 자리는 그리지 않는다
  if ((site.adSlots?.off ?? []).includes(slot)) return null
  const all = await liveBanners(site.outletId, slot)
  // 오른쪽 광고 개수 (기본 3개까지)
  const banners = slot === 'sidebar' ? all.slice(0, site.adSlots?.sidebarMax ?? 3) : all
  if (!banners.length) return null
  const wide = slot === 'sidebar' && !site.adSlots?.noWing
  if (wing && !wide) return null
  if (slot === 'popup') return <AdPopup banner={banners[0]} lang={site.lang} />
  return (
    // 옆 여백 광고: 3개까지는 화면을 따라다니고(sticky), 그보다 많으면 한 화면을 넘으므로 따라다니지 않고 페이지와 함께 자연스럽게 스크롤된다
    <div className={`space-y-3 ${className} ${wide && !wing ? 'min-[1840px]:hidden' : ''} ${wing && banners.length <= 3 ? 'sticky top-24' : ''}`} data-ad-slot={slot}>
      {banners.map((b) => <AdBannerView key={b.id} banner={b} lang={site.lang} />)}
    </div>
  )
}
