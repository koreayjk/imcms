// 광고 자리 설정 (편집장 이상이 광고 화면에서 직접): 안 쓰는 자리 끄기, 오른쪽 광고 개수. 매체 설정(site.adSlots)에 저장한다
export const AD_SLOT_IDS = ['header', 'sidebar', 'home_middle', 'home_bottom', 'article_top', 'article_bottom', 'popup'] as const
export type AdSlotKey = (typeof AD_SLOT_IDS)[number]
export type AdSlotSettings = { off?: AdSlotKey[]; sidebarMax?: 1 | 2 | 3 }

// 저장·표시 전에 걸러낸다
export function cleanAdSlots(v: unknown): AdSlotSettings | undefined {
  const o = (v ?? {}) as { off?: unknown; sidebarMax?: unknown }
  const off = (Array.isArray(o.off) ? o.off : []).filter((x): x is AdSlotKey => (AD_SLOT_IDS as readonly string[]).includes(String(x)))
  const max = Number(o.sidebarMax)
  const sidebarMax = max === 1 || max === 2 ? (max as 1 | 2) : undefined // 3(기본)은 저장하지 않는다
  if (!off.length && !sidebarMax) return undefined
  return { off: off.length ? Array.from(new Set(off)) : undefined, sidebarMax }
}
