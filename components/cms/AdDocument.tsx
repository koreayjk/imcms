import { koreanMoney } from '@/lib/korean-money'
import type { AdDocData } from '@/lib/ad-doc'
import { makeT, type CmsLang } from '@/lib/cms-i18n'

// 견적서·광고 게재 확인서 본문 (A4). 지금 내용으로 보여줄 때와 저장한 문서를 다시 열 때 같이 쓴다
const wonL = (n: number, lang: CmsLang) => (lang === 'en' ? `KRW ${Math.round(n).toLocaleString('en-US')}` : `${Math.round(n).toLocaleString('ko-KR')}원`)
const dot = (d: string | null | undefined) => (d ? d.replace(/-/g, '.') : '')
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1
const B = 'border border-[#999]'

// lang: 문서 언어 (편집국 언어와 같게 넘긴다. 없으면 한국어)
export default function AdDocument({ d, lang = 'ko' }: { d: AdDocData; lang?: CmsLang }) {
  const t = makeT(lang)
  const won = (n: number) => wonL(n, lang)
  const c = d.contract
  const s = d.supplier
  const stats = d.stats ?? []
  const sumViews = stats.reduce((n, x) => n + x.views, 0)
  const sumClicks = stats.reduce((n, x) => n + x.clicks, 0)

  const Supplier = (
    <table className="w-full border-collapse text-[12.5px]">
      <tbody>
        {[['company', t('상호', 'Company'), s.company], ['ceo', t('대표자', 'Representative'), s.ceo], ['bizno', t('사업자등록번호', 'Business reg. no.'), s.bizNo], ['address', t('주소', 'Address'), s.address], ['contact', t('연락처', 'Contact'), [s.phone, s.email].filter(Boolean).join(' · ')]].map(([id, k, v]) => (
          <tr key={id}><th className={`w-28 whitespace-nowrap ${B} bg-[#F3F4F6] px-2 py-1 text-left font-semibold`}>{k}</th><td className={`${B} px-2 py-1`}>{v || ' '}{id === 'ceo' && v ? <span className="ml-3 text-[#999]">{t('(인)', '(seal)')}</span> : null}</td></tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <article data-ad-doc className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[16mm] text-[#111] shadow print:max-w-none print:p-0 print:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.outlet.logo ? <img src={d.outlet.logo} alt={d.outlet.name} className="h-9 w-auto" /> : <p className="text-[20px] font-extrabold" style={{ color: d.outlet.brand }}>{d.outlet.name}</p>}
          {d.outlet.domain && <p className="mt-1 text-[11.5px] text-[#666]">{d.outlet.domain}</p>}
        </div>
        <p className="text-right text-[11.5px] text-[#666]">{t('문서번호', 'Document no.')} {d.no}</p>
      </div>

      <h1 className={`mt-6 text-center text-[28px] font-extrabold ${lang === 'en' ? 'tracking-[0.1em]' : 'tracking-[0.5em]'}`}>{d.kind === 'quote' ? t('견적서', 'Quotation') : t('광고 게재 확인서', 'Ad Delivery Report')}</h1>

      {d.kind === 'quote' ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-6">
            <div className="space-y-1.5 text-[13.5px]">
              <p className="text-[17px] font-bold underline underline-offset-4">{c.receiver}{t(' 귀하', '')}</p>
              {c.contactName && <p>{t('담당', 'Attn')}: {c.contactName}{c.contactPhone ? ` (${c.contactPhone})` : ''}</p>}
              <p>{t('견적일', 'Quote date')}: {dot(d.issuedOn)}</p>
              <p>{t(`유효기간: 견적일로부터 30일 (${dot(addDays(d.issuedOn, 30))}까지)`, `Valid for: 30 days from the quote date (until ${dot(addDays(d.issuedOn, 30))})`)}</p>
              <p className="pt-2">{t('아래와 같이 견적합니다.', 'We are pleased to quote as follows.')}</p>
            </div>
            <div><p className="mb-1 text-[12px] font-semibold">{t('공급자', 'Supplier')}</p>{Supplier}</div>
          </div>
          <div className="mt-6 flex items-baseline justify-between border-y-2 border-[#111] px-3 py-3">
            <span className="text-[14px] font-bold">{t('합계 금액', 'Total amount')} {c.vat ? t('(부가세 포함)', '(VAT included)') : ''}</span>
            {lang === 'en'
              ? <span className="text-[17px] font-extrabold tabular-nums">{won(c.total)}</span>
              : <span className="text-[17px] font-extrabold">일금 {koreanMoney(c.total)}원정 <span className="ml-2 font-semibold tabular-nums">(₩{c.total.toLocaleString('ko-KR')})</span></span>}
          </div>
          <table className="mt-5 w-full border-collapse text-[12.5px]">
            <thead><tr className="bg-[#F3F4F6]">{[t('품목', 'Item'), t('광고 자리', 'Placement'), t('게재 기간', 'Run period'), t('공급가액', 'Net amount'), t('세액', 'Tax')].map((h) => <th key={h} className={`${B} px-2 py-1.5`}>{h}</th>)}</tr></thead>
            <tbody>
              <tr>
                <td className={`${B} px-2 py-2`}>{c.title}</td>
                <td className={`${B} px-2 py-2`}>{c.slots || '-'}</td>
                <td className={`${B} px-2 py-2 text-center tabular-nums`}>{dot(c.startsOn)} ~ {dot(c.endsOn)}<br /><span className="text-[11px] text-[#666]">({t(`${days(c.startsOn, c.endsOn)}일`, `${days(c.startsOn, c.endsOn)} ${days(c.startsOn, c.endsOn) === 1 ? 'day' : 'days'}`)})</span></td>
                <td className={`${B} px-2 py-2 text-right tabular-nums`}>{won(c.supply)}</td>
                <td className={`${B} px-2 py-2 text-right tabular-nums`}>{won(c.vat)}</td>
              </tr>
              <tr className="font-bold">
                <td colSpan={3} className={`${B} bg-[#F9FAFB] px-2 py-2 text-center`}>{t('합계', 'Total')}</td>
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
                [t('광고주', 'Advertiser'), c.receiver], [t('광고 내용', 'Ad description'), c.title], [t('게재 매체', 'Outlet'), `${d.outlet.name}${d.outlet.domain ? ` (https://${d.outlet.domain})` : ''}`],
                [t('게재 기간', 'Run period'), t(`${dot(c.startsOn)} ~ ${dot(c.endsOn)} (${days(c.startsOn, c.endsOn)}일)`, `${dot(c.startsOn)} ~ ${dot(c.endsOn)} (${days(c.startsOn, c.endsOn)} ${days(c.startsOn, c.endsOn) === 1 ? 'day' : 'days'})`)], [t('광고 자리', 'Placement'), c.slots || '-'],
              ].map(([k, v]) => <tr key={k}><th className={`w-28 ${B} bg-[#F3F4F6] px-3 py-2 text-left font-semibold`}>{k}</th><td className={`${B} px-3 py-2`}>{v}</td></tr>)}
            </tbody>
          </table>
          {stats.length > 0 && (
            <>
              <p className="mt-6 text-[13px] font-bold">{t('게재 실적', 'Delivery results')} {d.until && d.until < c.endsOn && <span className="font-normal text-[#666]">{t(`(게재 중 — ${dot(d.until)} 기준)`, `(still running — as of ${dot(d.until)})`)}</span>}</p>
              <table className="mt-2 w-full border-collapse text-[12.5px]">
                <thead><tr className="bg-[#F3F4F6]">{[t('광고 자리', 'Placement'), t('노출 수', 'Impressions'), t('클릭 수', 'Clicks'), t('클릭률', 'CTR')].map((h) => <th key={h} className={`${B} px-2 py-1.5`}>{h}</th>)}</tr></thead>
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
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-center`}>{t('합계', 'Total')}</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumViews.toLocaleString()}</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumClicks.toLocaleString()}</td>
                      <td className={`${B} bg-[#F9FAFB] px-2 py-2 text-right tabular-nums`}>{sumViews ? ((sumClicks / sumViews) * 100).toFixed(2) : '0.00'}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-1 text-[11px] text-[#666]">{t('노출 수는 검색 로봇을 뺀 실제 독자 화면에 광고가 보인 횟수, 클릭 수는 광고를 눌러 광고주 페이지로 이동한 횟수입니다.', 'Impressions are the number of times the ad was shown on real readers’ screens (search bots excluded); clicks are the number of times the ad was clicked through to the advertiser’s page.')}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {stats.filter((x) => x.image).map((x) => <figure key={x.slot} className="text-center text-[11px] text-[#666]"><img src={x.image!} alt="" className="max-h-28 max-w-[220px] border border-[#ddd] object-contain" /><figcaption className="mt-1">{x.slot}</figcaption></figure>)}
              </div>
            </>
          )}
          <p className="mt-8 text-center text-[14px]">{t('위와 같이 광고가 게재되었음을 확인합니다.', 'We confirm that the ad was delivered as described above.')}</p>
          <p className="mt-3 text-center text-[13.5px] tabular-nums">{dot(d.issuedOn)}</p>
          <div className="mx-auto mt-6 max-w-[360px]"><p className="mb-1 text-[12px] font-semibold">{t('발행', 'Issued by')}</p>{Supplier}</div>
        </>
      )}

      {c.note && <div className="mt-6 whitespace-pre-line border-t border-[#ddd] pt-3 text-[12.5px]"><span className="font-semibold">{t('안내', 'Note')} </span>{c.note}</div>}
    </article>
  )
}
