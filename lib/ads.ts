import { createClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'

// 매체 홈페이지 광고 자리 (supabase/ad-banners.sql)
export type AdSlotId = 'header' | 'sidebar' | 'home_middle' | 'article_bottom' | 'popup'

export const AD_SLOTS: { id: AdSlotId; label: string; where: string; size: string; many?: boolean }[] = [
  { id: 'header', label: '상단 띠', where: '모든 페이지 메뉴 아래', size: 'PC 1200×100 · 휴대폰 640×160' },
  { id: 'sidebar', label: '오른쪽', where: '홈·기사·섹션 오른쪽 (휴대폰은 본문 아래)', size: '300×250 (최대 3개까지 차례로)', many: true },
  { id: 'home_middle', label: '홈 중간', where: '첫 화면 주요뉴스 아래', size: 'PC 1200×150 · 휴대폰 640×200' },
  { id: 'article_bottom', label: '기사 아래', where: '기사 본문 끝', size: '760×150 · 휴대폰 640×200' },
  { id: 'popup', label: '첫 화면 팝업', where: '첫 화면에 뜨는 창 (“오늘 하루 보지 않기”)', size: '400×500' },
]
export const slotOf = (id: string) => AD_SLOTS.find((s) => s.id === id)

export type AdBanner = {
  id: string
  slot: AdSlotId
  kind: 'image' | 'code'
  name: string
  image_url: string | null
  mobile_image_url: string | null
  link_url: string | null
  code: string | null
  sort_order: number
}

// 지금 나가는 배너 (DB 권한이 켜져 있고 기간 안인 것만 준다). 5분마다, 저장하면 바로 새로 읽는다
const loadLive = unstable_cache(
  async (outletId: string): Promise<AdBanner[]> => {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { data, error } = await supabase
      .from('ad_banners')
      .select('id, slot, kind, name, image_url, mobile_image_url, link_url, code, sort_order')
      .eq('outlet_id', outletId)
      .order('sort_order')
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return data as AdBanner[]
  },
  ['ad-banners'],
  { revalidate: 300, tags: ['ads'] }
)

export async function liveBanners(outletId: string | undefined, slot: AdSlotId): Promise<AdBanner[]> {
  if (!outletId || !process.env.NEXT_PUBLIC_SUPABASE_URL) return []
  try {
    const all = (await loadLive(outletId)).filter((b) => b.slot === slot)
    if (slotOf(slot)?.many) return all.slice(0, 3)
    if (slot === 'popup') return all.slice(0, 1)
    // 한 자리에 여러 개면 들어올 때마다 하나씩 돌아가며
    return all.length ? [all[Math.floor(Math.random() * all.length)]] : []
  } catch {
    return []
  }
}
