import { koreanMoney } from '@/lib/korean-money'
import type { AdDocData } from '@/lib/ad-doc'

// 견적서·광고 게재 확인서 본문 (A4). 지금 내용으로 보여줄 때와 저장한 문서를 다시 열 때 같이 쓴다
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
const dot = (d: string | null | undefined) => (d ? d.replace(/-/g, '.') : '')
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1
const B = 'border border-[#999]'

export default function AdDocument({ d }: { d: AdDocData }) {
  const c = d.contract
  const s = d.supplier
  const stats = d.stats ?? []
  const sumViews = stats.reduce((n, x) => n + x.views, 0)
  const sumClicks = stats.reduce((n, x) => n + x.clicks, 0)

  const Supplier = (
    <table className="w-full border-collapse text-[12.5px]">
      <tbody>
        {[['상호', s.company], ['대표자', s.ceo], ['사업자등록번호', s.bizNo], ['주소', s.address], ['연락처', [s.phone, s.email].filter(Boolean).join(' · ')]].map(([k, v]) => (
          <tr key={k}><th className={`w-28 whitespace-nowrap ${B} bg-[#F3F4F6] px-2 py-1 text-left font-semibold`}>{k}</th><td className={`${B} px-2 py-1`}>{v || ' '}{k === '대표자' && v ? <span className="ml-3 text-[#999]">(인)</span> : null}</td></tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[#111] shadow print:max-w-none print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.outlet.logo ? <img src={d.outlet.logo} alt={d.outlet.name} className="h-9 w-auto" /> : <p className="text-[20px] font-extrabold" style={{ color: d.outlet.brand }}>{d.outlet.name}</p>}
          {d.outlet.domain && <p className="mt-1 text-[11.5px] text-[#666]">{d.outlet.domain}</p>}
        </div>
        <p className="text-right text-[11.5px] text-[#666]">문서번호 {d.no}</p>
      </div>

      <h1 className="mt-6 text-center text-[28px] font-extrabold tracking-[0.5em]">{d.kind === 'quote' ? '견적서' : '광고 게재 확인서'}</h1>

      {d.kind === 'quote' ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="space-y-1.5 text-[13.5px]">
              <p className="text-[17px] font-bold underline underline-offset-4">{c.receiver} 귀하</p>
              {c.contactName && <p>담당: {c.contactName}{c.contactPhone ? ` (${c.contactPhone})` : ''}</p>}
              <p>견적일: {dot(d.issuedOn)}</p>
              <p>유효기간: 견적일로부터 30일 ({dot(addDays(d.issuedOn, 30))}까지)</p>
              <p className="pt-2">아래와 같이 견적합니다.</p>
            </div>
            <div><p className="mb-1 text-[12px] font-semibold">공급자</p>{Supplier}</div>
          </div>
          <div className="mt-6 flex items-baseline justify-between border-y-2 border-[#111] px-3 py-3">
            <span className="text-[14px] font-bold">합계 금액 {c.vat ? '(부가세 포함)' : ''}</span>
            <span className="text-[17px] font-extrabold">일금 {koreanMoney(c.total)}원정 <span className="ml-2 font-semibold tabular-nums">(₩{c.total.toLocaleString('ko-KR')})</span></span>
          </div>
          <table className="mt-5 w-full border-collapse text-[12.5px]">
            <thead><tr className="bg-[#F3F4F6]">{['품목', '광고 자리', '게재 기간', '공급가액', '세액'].map((h) => <th key={h} className={`${B} px-2 py-1.5`}>{h}</th>)}</tr></thead>
            <tbody>
              <tr>
                <td className={`${B} px-2 py-2`}>{c.title}</td>
                <td className={`${B} px-2 py-2`}>{c.slots || '-'}</td>
                <td className={`${B} px-2 py-2 text-center tabular-nums`}>{dot(c.startsOn)} ~ {dot(c.endsOn)}<br /><span className="text-[11px] text-[#666]">({days(c.startsOn, c.endsOn)}일)</span></td>
                <td className={`${B} px-2 py-2 text-right tabular-nums`}>{won(c.supply)}</td>
                <td className={`${B} px-2 py-2 text-right tabular-nums`}>{won(c.vat)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className={`${B} bg-[#F9FAFB] px-2 py-2 text-center`}>합계</td>
                <td colSpan={2} className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{won(c.total)}</td>
              </tr>
            </tbody>
          </table>
        </>
      ) : (
        <>
          <table className="mt-8 w-full border-collapse text-[13px]">
            <tbody>
              {[
                ['광고주', c.receiver], ['광고 내용', c.title], ['게재 매체', `${d.outlet.name}${d.outlet.domain ? ` (https://${d.outlet.domain})` : ''}`],
                ['게재 기간', `${dot(c.startsOn)} ~ ${dot(c.endsOn)} (${days(c.startsOn, c.endsOn)}일)`], ['광고 자리', c.slots || '-'],
              ].map(([k, v]) => <tr key={k}><th className={`w-28 ${B} bg-[#F3F4F6] px-3 py-2 text-left font-semibold`}>{k}</th><td className={`${B} px-3 py-2`}>{v}</td></tr>)}
            </tbody>
          </table>
          {stats.length > 0 && (
            <>
              <p className="mt-6 text-[13px] font-bold">게재 실적 {d.until && d.until < c.endsOn && <span className="font-normal text-[#666]">(게재 중 — {dot(d.until)} 기준)</span>}</p>
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead><tr className="bg-[#F3F4F6]">{['광고 자리', '노출 수', '클릭 수', '클릭률'].map((h) => <th key={h} className={`${B} px-2 py-1.5`}>{h}</th>)}</tr></thead>
                <tbody>
                  {stats.map((x) => (
                    <tr key={x.slot}>
                      <td className={`${B} px-2 py-2`}>{x.slot}</td>
                      <td className={`${B} px-2 py-2 text-right tabular-nums`}>{x.views.toLocaleString()}</td>
                      <td className={`${B} px-2 py-2 text-right tabular-nums`}>{x.clicks.toLocaleString()}</td>
                      <td className={`${B} px-2 py-2 text-right tabular-nums`}>{x.views ? ((x.clicks / x.views) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                  ))}
                  {stats.length > 1 && (
                    <tr className="font-bold">
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-center`}>합계</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumViews.toLocaleString()}</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumClicks.toLocaleString()}</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumViews ? ((sumClicks / sumViews) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-[#666]">노출 수는 검색 로봇을 뺀 실제 독자 화면에 광고가 보인 횟수, 클릭 수는 광고를 눌러 광고주 페이지로 이동한 횟수입니다.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {stats.filter((x) => x.image).map((x) => <figure key={x.slot} className="text-center text-[11px] text-[#666]"><img src={x.image!} alt="" className="max-h-28 max-w-[220px] border border-[#ddd] object-contain" /><figcaption className="mt-1">{x.slot}</figcaption></figure>)}
              </div>
            </>
          )}
          <p className="mt-8 text-center text-[14px]">위와 같이 광고가 게재되었음을 확인합니다.</p>
          <p className="mt-3 text-center text-[13.5px] tabular-nums">{dot(d.issuedOn)}</p>
          <div className="mx-auto mt-6 max-w-[360px]"><p className="mb-1 text-[12px] font-semibold">발행</p>{Supplier}</div>
        </>
      )}

      {c.note && <div className="mt-6 whitespace-pre-line border-t border-[#ddd] pt-3 text-[12.5px]"><span className="font-semibold">안내 </span>{c.note}</div>}
    </article>
  )
}
