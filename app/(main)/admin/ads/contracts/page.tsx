import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import AdTabs from '@/components/cms/AdTabs'
import AdContracts, { type Contract } from '@/components/cms/AdContracts'
import type { Booking } from '@/components/cms/AdCalendar'

// 광고 계약 장부 (그 매체 편집장·발행인). 매출 정보라 IM 뉴스룸 매니저에게는 보이지 않는다
export default async function AdContractsPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus) redirect(isStaff ? '/admin/ads' : '/newsroom')
  if (!outletId) redirect('/admin/ads')

  const [{ data: outlet }, contractsRes, { data: bannerRows }] = await Promise.all([
    supabase.from('outlets').select('name').eq('id', outletId).maybeSingle(),
    supabase.from('ad_contracts').select('*').eq('outlet_id', outletId).order('starts_on', { ascending: false }).limit(1000),
    supabase.from('ad_banners').select('id, name, slot, contract_id, exclusive, active, starts_at, ends_at, image_url, mobile_image_url, link_url').eq('outlet_id', outletId).eq('kind', 'image').order('created_at', { ascending: false }),
  ])
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  // 계약에 연결된 배너(예약 광고)의 계약 기간 안 노출·클릭
  type Row = { id: string; name: string; slot: string; contract_id: string | null; exclusive: boolean; active: boolean; starts_at: string | null; ends_at: string | null; image_url: string | null; mobile_image_url: string | null; link_url: string | null }
  const banners = (bannerRows ?? []) as Row[]
  const linked = banners.filter((b) => b.contract_id)
  const { data: stats } = linked.length
    ? await supabase.from('ad_stats').select('banner_id, day, views, clicks').in('banner_id', linked.map((b) => b.id))
    : { data: [] as { banner_id: string; day: string; views: number; clicks: number }[] }
  const rawContracts = (contractsRes.data ?? []) as any[]
  const advertiserOf = new Map(rawContracts.map((c) => [c.id as string, c.advertiser as string]))
  const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10)
  // 달력에 보일 예약: 켜져 있는 예약 광고 (한국 날짜, 끝나는 날 포함)
  const bookings: Booking[] = banners.filter((b) => b.exclusive && b.active && b.starts_at && b.ends_at).map((b) => ({
    slot: b.slot, start: kstDay(b.starts_at!), end: kstDay(new Date(Date.parse(b.ends_at!) - 1000).toISOString()),
    advertiser: (b.contract_id && advertiserOf.get(b.contract_id)) || b.name.split(' · ')[0], contractId: b.contract_id,
  }))
  const contracts: Contract[] = rawContracts.map((c) => {
    const mineBanners = linked.filter((b) => b.contract_id === c.id)
    const ids = mineBanners.map((b) => b.id)
    const mine = (stats ?? []).filter((s) => ids.includes(s.banner_id) && s.day >= c.starts_on && s.day <= c.ends_on)
    return {
      ...c,
      supply_amount: Number(c.supply_amount), vat_amount: Number(c.vat_amount), paid_amount: Number(c.paid_amount),
      banner_ids: ids,
      creatives: mineBanners.map((b) => ({ id: b.id, slot: b.slot, image_url: b.image_url ?? '', mobile_image_url: b.mobile_image_url ?? '', link_url: b.link_url ?? '' })),
      views: mine.reduce((n, s) => n + (s.views ?? 0), 0),
      clicks: mine.reduce((n, s) => n + (s.clicks ?? 0), 0),
    }
  })

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight">광고</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          들어온 광고를 계약 단위로 적어 둡니다. 광고 자리를 고르면 달력에서 빈 날짜를 확인해 예약하고, 사진을 미리 올려 두면 시작일에 자동으로 나가고 끝나면 내려갑니다(같은 자리의 기본 배너는 그동안 쉽니다). 금액·입금·세금계산서와 노출·클릭 수도 함께 봅니다.
          이 화면은 우리 매체 편집장·발행인만 봅니다.
        </p>
      </header>
      <AdTabs current="contracts" showContracts />
      {contractsRes.error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">광고 계약을 쓰려면 Supabase에서 <code>supabase/ad-contracts.sql</code>을 실행해 주세요.</p>
      ) : (
        <AdContracts contracts={contracts} bookings={bookings} today={today} outletId={outletId} outletName={(outlet as { name?: string } | null)?.name ?? '매체'} />
      )}
    </div>
  )
}
