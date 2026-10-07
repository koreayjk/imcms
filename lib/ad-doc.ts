import { buildSite, type OutletRow } from './sites'
import { slotOf } from './ads'

// 광고 문서(견적서·게재 확인서)에 들어가는 내용. 저장하면 이 내용을 그대로 보관한다 (ad_documents.data)
export type AdDocKind = 'quote' | 'report'
export type AdDocData = {
  kind: AdDocKind
  no: string
  // 문서 날짜 (견적서: 견적일, 확인서: 발급일)
  issuedOn: string
  outlet: { name: string; domain: string | null; logo: string; brand: string }
  supplier: { company: string; ceo: string; bizNo: string; address: string; phone: string; email: string }
  contract: {
    advertiser: string; receiver: string; title: string; contactName: string | null; contactPhone: string | null
    startsOn: string; endsOn: string; quotedOn: string | null; supply: number; vat: number; total: number; slots: string; note: string | null
  }
  // 게재 확인서: 자리별 실적 (until 날짜까지 집계)
  stats?: { slot: string; views: number; clicks: number; image: string | null }[]
  until?: string
}

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = any

// 다음 문서 번호: Q-2026-0001 (견적서) / R-2026-0001 (게재 확인서), 매체·종류·연도별로 차례대로
export async function nextDocNo(supabase: Sb, outletId: string, kind: AdDocKind, year = kstToday().slice(0, 4)) {
  const prefix = `${kind === 'quote' ? 'Q' : 'R'}-${year}-`
  const { data } = await supabase.from('ad_documents').select('doc_no').eq('outlet_id', outletId).like('doc_no', `${prefix}%`).order('doc_no', { ascending: false }).limit(1)
  const last = Number(((data ?? [])[0]?.doc_no ?? '').slice(prefix.length)) || 0
  return `${prefix}${String(last + 1).padStart(4, '0')}`
}

// 지금 DB 내용으로 문서 내용을 만든다 (권한은 DB가 확인: 우리 매체 계약만 읽힌다)
export async function buildAdDoc(supabase: Sb, contractId: string, kind: AdDocKind): Promise<AdDocData | null> {
  const { data: c } = await supabase.from('ad_contracts').select('*').eq('id', contractId).maybeSingle()
  if (!c) return null
  const [{ data: outlet }, { data: bannerRows }] = await Promise.all([
    supabase.from('outlets').select('*').eq('id', c.outlet_id).maybeSingle(),
    supabase.from('ad_banners').select('id, slot, image_url').eq('contract_id', contractId),
  ])
  if (!outlet) return null
  const site = buildSite(outlet as OutletRow, [])
  const legal = site.legal
  const today = kstToday()
  const supply = Number(c.supply_amount)
  const vat = Number(c.vat_amount)
  const banners = (bannerRows ?? []) as { id: string; slot: string; image_url: string | null }[]
  const data: AdDocData = {
    kind,
    no: '',
    issuedOn: kind === 'quote' ? c.quoted_on ?? today : today,
    outlet: { name: site.name, domain: (outlet as { domain?: string | null }).domain ?? null, logo: site.logoMark, brand: site.colors.brand },
    supplier: {
      company: legal.company || site.name, ceo: legal.ceo, bizNo: legal.bizNo,
      address: [legal.postcode && `(${legal.postcode})`, legal.address].filter(Boolean).join(' '), phone: legal.phone, email: legal.email,
    },
    contract: {
      advertiser: c.advertiser, receiver: c.biz_name || c.advertiser, title: c.title,
      contactName: c.contact_name, contactPhone: c.contact_phone,
      startsOn: c.starts_on, endsOn: c.ends_on, quotedOn: c.quoted_on,
      supply, vat, total: supply + vat,
      slots: banners.map((b) => slotOf(b.slot)?.label ?? b.slot).join(' · '),
      note: c.doc_note,
    },
  }
  if (kind === 'report') {
    const until = c.ends_on < today ? c.ends_on : today
    data.until = until
    if (banners.length) {
      const { data: rows } = await supabase.from('ad_stats').select('banner_id, views, clicks').in('banner_id', banners.map((b) => b.id)).gte('day', c.starts_on).lte('day', until)
      data.stats = banners.map((b) => {
        const mine = ((rows ?? []) as { banner_id: string; views: number; clicks: number }[]).filter((r) => r.banner_id === b.id)
        return { slot: slotOf(b.slot)?.label ?? b.slot, image: b.image_url, views: mine.reduce((n, r) => n + (r.views ?? 0), 0), clicks: mine.reduce((n, r) => n + (r.clicks ?? 0), 0) }
      })
    }
  }
  return data
}
