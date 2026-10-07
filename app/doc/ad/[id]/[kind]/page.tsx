import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { buildSite, type OutletRow } from '@/lib/sites'
import { slotOf } from '@/lib/ads'
import { koreanMoney } from '@/lib/korean-money'
import PrintButton from '@/components/cms/PrintButton'

// 광고 문서 (인쇄·PDF 저장): 견적서 / 광고 게재 확인서. 그 매체 편집장·발행인만 (DB 권한으로 확인)
export const metadata: Metadata = { title: '광고 문서', robots: { index: false } }

type Props = { params: Promise<{ id: string; kind: string }> }

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const dot = (d: string | null | undefined) => (d ? d.replace(/-/g, '.') : '')
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1

export default async function AdDocPage(props: Props) {
  const { id, kind } = await props.params
  if (kind !== 'quote' && kind !== 'report') notFound()
  const { supabase, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/newsroom')

  const { data: c } = await supabase.from('ad_contracts').select('*').eq('id', id).maybeSingle()
  if (!c) notFound()
  const [{ data: outlet }, { data: bannerRows }] = await Promise.all([
    supabase.from('outlets').select('*').eq('id', c.outlet_id).maybeSingle(),
    supabase.from('ad_banners').select('id, slot, image_url, starts_at, ends_at').eq('contract_id', id),
  ])
  if (!outlet) notFound()
  const site = buildSite(outlet as OutletRow, [])
  const legal = site.legal
  const company = legal.company || site.name
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  const supply = Number(c.supply_amount)
  const vat = Number(c.vat_amount)
  const total = supply + vat
  const banners = (bannerRows ?? []) as { id: string; slot: string; image_url: string | null }[]
  const slotNames = banners.map((b) => slotOf(b.slot)?.label ?? b.slot).join(' · ')
  const receiver = c.biz_name || c.advertiser
  const no = `${kind === 'quote' ? 'Q' : 'R'}-${(c.quoted_on ?? c.starts_on).replace(/-/g, '')}-${String(c.id).slice(0, 4).toUpperCase()}`

  // 게재 확인서: 계약 기간(오늘까지) 노출·클릭
  let stats: { slot: string; views: number; clicks: number; image: string | null }[] = []
  const until = c.ends_on < today ? c.ends_on : today
  if (kind === 'report' && banners.length) {
    const { data } = await supabase.from('ad_stats').select('banner_id, day, views, clicks').in('banner_id', banners.map((b) => b.id)).gte('day', c.starts_on).lte('day', until)
    stats = banners.map((b) => {
      const rows = (data ?? []).filter((s) => s.banner_id === b.id)
      return { slot: slotOf(b.slot)?.label ?? b.slot, image: b.image_url, views: rows.reduce((n, r) => n + (r.views ?? 0), 0), clicks: rows.reduce((n, r) => n + (r.clicks ?? 0), 0) }
    })
  }
  const sumViews = stats.reduce((n, s) => n + s.views, 0)
  const sumClicks = stats.reduce((n, s) => n + s.clicks, 0)

  const Supplier = (
    <table className="w-full border-collapse text-[12.5px]">
      <tbody>
        {[
          ['상호', company], ['대표자', legal.ceo], ['사업자등록번호', legal.bizNo],
          ['주소', [legal.postcode && `(${legal.postcode})`, legal.address].filter(Boolean).join(' ')], ['연락처', [legal.phone, legal.email].filter(Boolean).join(' · ')],
        ].map(([k, v]) => (
          <tr key={k}><th className="w-28 whitespace-nowrap border border-[#999] bg-[#F3F4F6] px-2 py-1 text-left font-semibold">{k}</th><td className="border border-[#999] px-2 py-1">{v || ' '}{k === '대표자' && v ? <span className="ml-3 text-[#999]">(인)</span> : null}</td></tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <div className="min-h-screen bg-[#E5E7EB] py-6 print:bg-white print:py-0">
      <style>{'@page { size: A4; margin: 14mm } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2 print:hidden">
        <p className="text-[13px] text-[#4B5563]">인쇄하거나, 인쇄 창에서 ‘PDF로 저장’을 고르면 광고주에게 보낼 파일이 됩니다.</p>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[#111] shadow print:max-w-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {site.logoMark ? <img src={site.logoMark} alt={site.name} className="h-9 w-auto" /> : <p className="text-[20px] font-extrabold" style={{ color: site.colors.brand }}>{site.name}</p>}
            {outlet.domain && <p className="mt-1 text-[11.5px] text-[#666]">{outlet.domain}</p>}
          </div>
          <p className="text-right text-[11.5px] text-[#666]">문서번호 {no}</p>
        </div>

        <h1 className="mt-6 text-center text-[28px] font-extrabold tracking-[0.5em]">{kind === 'quote' ? '견적서' : '광고 게재 확인서'}</h1>

        {kind === 'quote' ? (
          <>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div className="space-y-1.5 text-[13.5px]">
                <p className="text-[17px] font-bold underline underline-offset-4">{receiver} 귀하</p>
                {c.contact_name && <p>담당: {c.contact_name}{c.contact_phone ? ` (${c.contact_phone})` : ''}</p>}
                <p>견적일: {dot(c.quoted_on ?? today)}</p>
                <p>유효기간: 견적일로부터 30일 ({dot(addDays(c.quoted_on ?? today, 30))}까지)</p>
                <p className="pt-2">아래와 같이 견적합니다.</p>
              </div>
              <div><p className="mb-1 text-[12px] font-semibold">공급자</p>{Supplier}</div>
            </div>
            <div className="mt-6 flex items-baseline justify-between border-y-2 border-[#111] px-3 py-3">
              <span className="text-[14px] font-bold">합계 금액 {vat ? '(부가세 포함)' : ''}</span>
              <span className="text-[17px] font-extrabold">일금 {koreanMoney(total)}원정 <span className="ml-2 font-semibold tabular-nums">(₩{total.toLocaleString('ko-KR')})</span></span>
            </div>
            <table className="mt-5 w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="bg-[#F3F4F6]">{['품목', '광고 자리', '게재 기간', '공급가액', '세액'].map((h) => <th key={h} className="border border-[#999] px-2 py-1.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-[#999] px-2 py-2">{c.title}</td>
                  <td className="border border-[#999] px-2 py-2">{slotNames || '-'}</td>
                  <td className="border border-[#999] px-2 py-2 text-center tabular-nums">{dot(c.starts_on)} ~ {dot(c.ends_on)}<br /><span className="text-[11px] text-[#666]">({days(c.starts_on, c.ends_on)}일)</span></td>
                  <td className="border border-[#999] px-2 py-2 text-right tabular-nums">{won(supply)}</td>
                  <td className="border border-[#999] px-2 py-2 text-right tabular-nums">{won(vat)}</td>
                </tr>
                <tr className="font-bold">
                  <td colSpan={3} className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-center">합계</td>
                  <td colSpan={2} className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-right tabular-nums">{won(total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        ) : (
          <>
            <table className="mt-8 w-full border-collapse text-[13px]">
              <tbody>
                {[
                  ['광고주', receiver], ['광고 내용', c.title], ['게재 매체', `${site.name}${outlet.domain ? ` (https://${outlet.domain})` : ''}`],
                  ['게재 기간', `${dot(c.starts_on)} ~ ${dot(c.ends_on)} (${days(c.starts_on, c.ends_on)}일)`], ['광고 자리', slotNames || '-'],
                ].map(([k, v]) => (
                  <tr key={k}><th className="w-28 border border-[#999] bg-[#F3F4F6] px-3 py-2 text-left font-semibold">{k}</th><td className="border border-[#999] px-3 py-2">{v}</td></tr>
                ))}
              </tbody>
            </table>
            {stats.length > 0 && (
              <>
                <p className="mt-6 text-[13px] font-bold">게재 실적 {c.ends_on >= today && <span className="font-normal text-[#666]">(게재 중 — {dot(today)} 기준)</span>}</p>
                <table className="mt-2 w-full border-collapse text-[12.5px]">
                  <thead><tr className="bg-[#F3F4F6]">{['광고 자리', '노출 수', '클릭 수', '클릭률'].map((h) => <th key={h} className="border border-[#999] px-2 py-1.5">{h}</th>)}</tr></thead>
                  <tbody>
                    {stats.map((s) => (
                      <tr key={s.slot}>
                        <td className="border border-[#999] px-2 py-2">{s.slot}</td>
                        <td className="border border-[#999] px-2 py-2 text-right tabular-nums">{s.views.toLocaleString()}</td>
                        <td className="border border-[#999] px-2 py-2 text-right tabular-nums">{s.clicks.toLocaleString()}</td>
                        <td className="border border-[#999] px-2 py-2 text-right tabular-nums">{s.views ? ((s.clicks / s.views) * 100).toFixed(2) : '0.00'}%</td>
                      </tr>
                    ))}
                    {stats.length > 1 && (
                      <tr className="font-bold"><td className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-center">합계</td><td className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-right tabular-nums">{sumViews.toLocaleString()}</td><td className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-right tabular-nums">{sumClicks.toLocaleString()}</td><td className="border border-[#999] bg-[#F9FAFB] px-2 py-2 text-right tabular-nums">{sumViews ? ((sumClicks / sumViews) * 100).toFixed(2) : '0.00'}%</td></tr>
                    )}
                  </tbody>
                </table>
                <p className="mt-1 text-[11px] text-[#666]">노출 수는 검색 로봇을 뺀 실제 독자 화면에 광고가 보인 횟수, 클릭 수는 광고를 눌러 광고주 페이지로 이동한 횟수입니다.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {stats.filter((s) => s.image).map((s) => <figure key={s.slot} className="text-center text-[11px] text-[#666]"><img src={s.image!} alt="" className="max-h-28 max-w-[220px] border border-[#ddd] object-contain" /><figcaption className="mt-1">{s.slot}</figcaption></figure>)}
                </div>
              </>
            )}
            <p className="mt-8 text-center text-[14px]">위와 같이 광고가 게재되었음을 확인합니다.</p>
            <p className="mt-3 text-center text-[13.5px] tabular-nums">{dot(today)}</p>
            <div className="mx-auto mt-6 max-w-[360px]"><p className="mb-1 text-[12px] font-semibold">발행</p>{Supplier}</div>
          </>
        )}

        {c.doc_note && <div className="mt-6 whitespace-pre-line border-t border-[#ddd] pt-3 text-[12.5px]"><span className="font-semibold">안내 </span>{c.doc_note}</div>}
      </article>
    </div>
  )
}
