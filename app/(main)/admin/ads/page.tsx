import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import AdManager, { type ManagedBanner } from '@/components/cms/AdManager'
import AdTabs from '@/components/cms/AdTabs'

// 광고 배너 관리 (편집장·발행인·운영팀). 작업 중인 매체의 배너만
export default async function AdsPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/newsroom')

  if (!outletId) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-10 md:px-8">
        <p className="rounded-lg border border-line bg-white px-5 py-4 text-sm">위쪽에서 광고를 관리할 매체를 먼저 골라 주세요.</p>
      </div>
    )
  }

  const { data, error } = await supabase
    .from('ad_banners')
    .select('id, slot, kind, name, image_url, mobile_image_url, link_url, code, starts_at, ends_at, active, sort_order')
    .eq('outlet_id', outletId)
    .order('sort_order')
    .order('created_at', { ascending: false })
  const ids = (data ?? []).map((b) => b.id as string)
  const { data: stats } = ids.length
    ? await supabase.from('ad_stats').select('banner_id, day, views, clicks').in('banner_id', ids)
    : { data: [] as { banner_id: string; day: string; views: number; clicks: number }[] }
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
  const banners: ManagedBanner[] = (data ?? []).map((b: any) => {
    const mine = (stats ?? []).filter((s) => s.banner_id === b.id)
    const recent = mine.filter((s) => s.day >= since)
    const sum = (rows: typeof mine, k: 'views' | 'clicks') => rows.reduce((n, r) => n + (r[k] ?? 0), 0)
    return { ...b, views: sum(mine, 'views'), clicks: sum(mine, 'clicks'), views30: sum(recent, 'views'), clicks30: sum(recent, 'clicks') }
  })

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{isEditorPlus ? '광고' : '광고 배너'}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          홈페이지 정해진 자리에 광고를 겁니다. 기간을 정해 두면 그 기간에만 나가고, 노출·클릭 수가 하루 단위로 집계됩니다(검색 로봇 제외).
          배너에는 기사와 헷갈리지 않게 작은 “광고” 표시가 붙습니다.
          {isEditorPlus && <> 여기 올린 배너는 <strong>기본 배너</strong>입니다. ‘광고 계약’에서 예약한 광고가 나가는 기간에는 같은 자리의 기본 배너가 쉬었다가(오른쪽 자리는 남는 칸에 계속), 계약 광고가 끝나면 다시 나옵니다.</>}
        </p>
        {!isStaff && (
          <p className="mt-3 rounded-lg border border-review/30 bg-review/5 px-4 py-3 text-[13px] leading-relaxed">
            구글 애드센스·카카오 애드핏 같은 광고 코드는 홈페이지에서 그대로 실행되어 보안상 IM 뉴스룸 운영팀이 넣어 드립니다.{' '}
            <Link href="/support/tickets/new" className="font-semibold text-review underline underline-offset-2">업무요청 쓰기 →</Link>
          </p>
        )}
      </header>
      <AdTabs current="banners" showContracts={isEditorPlus} />
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">광고 배너를 쓰려면 Supabase에서 <code>supabase/ad-banners.sql</code>을 실행해 주세요.</p>
      ) : (
        <AdManager banners={banners} outletId={outletId} isStaff={isStaff} now={Date.now()} />
      )}
    </div>
  )
}
