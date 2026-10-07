import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import AdTabs from '@/components/cms/AdTabs'
import AdContracts, { type BannerOption, type Contract } from '@/components/cms/AdContracts'

// 광고 계약 장부 (그 매체 편집장·발행인). 매출 정보라 IM 뉴스룸 매니저에게는 보이지 않는다
export default async function AdContractsPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus) redirect(isStaff ? '/admin/ads' : '/newsroom')
  if (!outletId) redirect('/admin/ads')

  const [{ data: outlet }, contractsRes, { data: bannerRows }] = await Promise.all([
    supabase.from('outlets').select('name').eq('id', outletId).maybeSingle(),
    supabase.from('ad_contracts').select('*').eq('outlet_id', outletId).order('starts_on', { ascending: false }).limit(1000),
    supabase.from('ad_banners').select('id, name, slot, contract_id').eq('outlet_id', outletId).eq('kind', 'image').order('created_at', { ascending: false }),
  ])
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

  // 계약에 연결된 배너의 계약 기간 안 노출·클릭
  const banners = ((bannerRows ?? []) as (BannerOption & { contract_id?: string | null })[]).map((b) => ({ ...b, contract_id: b.contract_id ?? null }))
  const linked = banners.filter((b) => b.contract_id)
  const { data: stats } = linked.length
    ? await supabase.from('ad_stats').select('banner_id, day, views, clicks').in('banner_id', linked.map((b) => b.id))
    : { data: [] as { banner_id: string; day: string; views: number; clicks: number }[] }
  const contracts: Contract[] = ((contractsRes.data ?? []) as any[]).map((c) => {
    const ids = linked.filter((b) => b.contract_id === c.id).map((b) => b.id)
    const mine = (stats ?? []).filter((s) => ids.includes(s.banner_id) && s.day >= c.starts_on && s.day <= c.ends_on)
    return {
      ...c,
      supply_amount: Number(c.supply_amount), vat_amount: Number(c.vat_amount), paid_amount: Number(c.paid_amount),
      banner_ids: ids,
      views: mine.reduce((n, s) => n + (s.views ?? 0), 0),
      clicks: mine.reduce((n, s) => n + (s.clicks ?? 0), 0),
    }
  })

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-4">
        <h1 className="text-[22px] font-bold tracking-tight">광고</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          들어온 광고를 계약 단위로 적어 둡니다. 광고주·금액·기간·입금·세금계산서를 한곳에서 보고, 배너를 연결하면 계약 기간의 노출·클릭 수가 함께 나와 광고주에게 보고할 때 씁니다.
          이 화면은 우리 매체 편집장·발행인만 봅니다.
        </p>
      </header>
      <AdTabs current="contracts" showContracts />
      {contractsRes.error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">광고 계약을 쓰려면 Supabase에서 <code>supabase/ad-contracts.sql</code>을 실행해 주세요.</p>
      ) : (
        <AdContracts contracts={contracts} banners={banners} today={today} outletName={(outlet as { name?: string } | null)?.name ?? '매체'} />
      )}
    </div>
  )
}
