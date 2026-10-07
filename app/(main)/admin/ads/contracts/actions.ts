'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { slotOf } from '@/lib/ads'

export type ContractState = { error?: string; ok?: string }

export type ContractInput = {
  id?: string
  advertiser: string
  title: string
  contact_name: string
  contact_phone: string
  contact_email: string
  starts_on: string // YYYY-MM-DD
  ends_on: string
  supply_amount: number
  vat_amount: number
  paid_amount: number
  paid_on: string
  tax_invoice_on: string
  memo: string
  // 예약할 광고 자리와 소재 (자리마다 하나). 계약 기간에 자동으로 나가고 끝나면 내려간다
  creatives: Creative[]
}

export type Creative = { id?: string; slot: string; image_url: string; mobile_image_url: string; link_url: string }

const httpUrl = (v: string) => {
  const t = (v ?? '').trim()
  if (!t) return null
  const u = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try { return new URL(u).protocol.startsWith('http') ? u : null } catch { return null }
}
const capOf = (slot: string) => (slotOf(slot)?.many ? 3 : 1)
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const cut = (v: string, n: number) => v.trim().replace(/\s+/g, ' ').slice(0, n) || null
const money = (n: number, max: number) => Math.min(max, Math.max(0, Math.round(Number(n) || 0)))
// 계약일(한국 날짜) → 배너 게재 시각: 시작일 0시 ~ 끝나는 날 다음 날 0시 (한국 시간)
const kstStart = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString()
const kstEnd = (d: string) => new Date(Date.parse(`${d}T00:00:00+09:00`) + 864e5).toISOString()

async function ctx() {
  const c = await getCmsContext()
  if (!c.isEditorPlus || !c.outletId) return null
  return c
}

// 광고 계약 저장 (그 매체 편집장·발행인. DB가 한 번 더 확인한다)
export async function saveContract(input: ContractInput): Promise<ContractState> {
  const c = await ctx()
  if (!c) return { error: '광고 계약은 편집장·발행인만 관리할 수 있습니다.' }
  const { supabase, outletId } = c
  const advertiser = cut(input.advertiser, 80)
  const title = cut(input.title, 120)
  if (!advertiser) return { error: '광고주를 적어 주세요.' }
  if (!title) return { error: '광고 내용을 적어 주세요. (예: 홈 상단 배너 3개월)' }
  if (!DATE.test(input.starts_on) || !DATE.test(input.ends_on)) return { error: '광고 기간(시작일·끝나는 날)을 정해 주세요.' }
  if (input.ends_on < input.starts_on) return { error: '끝나는 날이 시작일보다 빠릅니다.' }
  const email = cut(input.contact_email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '담당자 이메일을 확인해 주세요.' }
  // 광고 소재 확인
  const creatives: { id?: string; slot: string; image: string; mobile: string | null; link: string | null }[] = []
  for (const cr of (input.creatives ?? []).slice(0, 5)) {
    const slot = slotOf(cr.slot)
    if (!slot) return { error: '광고 자리를 확인해 주세요.' }
    if (creatives.some((x) => x.slot === cr.slot)) return { error: `${slot.label} 자리가 두 번 들어 있습니다.` }
    const image = httpUrl(cr.image_url)
    if (!image) return { error: `${slot.label} 자리에 쓸 광고 사진(PC용)을 올려 주세요.` }
    if (cr.link_url?.trim() && !httpUrl(cr.link_url)) return { error: `${slot.label} 광고를 누르면 갈 주소를 확인해 주세요. 예: https://example.com` }
    creatives.push({ id: cr.id, slot: cr.slot, image, mobile: httpUrl(cr.mobile_image_url), link: httpUrl(cr.link_url) })
  }
  // 예약 겹침 확인 (DB도 한 번 더 막는다): 같은 자리·같은 날의 다른 예약 광고 수가 정원 이상이면 안 된다
  if (creatives.length) {
    const { data: taken } = await supabase.from('ad_banners')
      .select('slot, name, starts_at, ends_at, contract_id')
      .eq('outlet_id', outletId!).eq('exclusive', true).eq('active', true)
      .in('slot', creatives.map((x) => x.slot))
      .lt('starts_at', kstEnd(input.ends_on)).gt('ends_at', kstStart(input.starts_on))
    const others = ((taken ?? []) as { slot: string; name: string; starts_at: string; ends_at: string; contract_id: string | null }[])
      .filter((b) => !input.id || b.contract_id !== input.id)
    for (const cr of creatives) {
      const mine = others.filter((b) => b.slot === cr.slot)
      for (let d = input.starts_on; d <= input.ends_on; d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)) {
        const on = mine.filter((b) => kstDay(b.starts_at) <= d && kstDay(new Date(Date.parse(b.ends_at) - 1000).toISOString()) >= d)
        if (on.length >= capOf(cr.slot)) {
          return { error: `${slotOf(cr.slot)!.label} 자리는 ${d.replace(/-/g, '.')}에 이미 예약이 있습니다 (${on.map((b) => b.name.split(' · ')[0]).join(', ')}). 달력에서 빈 날짜를 골라 주세요.` }
        }
      }
    }
  }
  const row = {
    outlet_id: outletId!,
    advertiser, title,
    contact_name: cut(input.contact_name, 40),
    contact_phone: cut(input.contact_phone, 40),
    contact_email: email,
    starts_on: input.starts_on,
    ends_on: input.ends_on,
    supply_amount: money(input.supply_amount, 99_999_999_999),
    vat_amount: money(input.vat_amount, 9_999_999_999),
    paid_amount: money(input.paid_amount, 99_999_999_999),
    paid_on: DATE.test(input.paid_on) ? input.paid_on : null,
    tax_invoice_on: DATE.test(input.tax_invoice_on) ? input.tax_invoice_on : null,
    memo: input.memo.trim().slice(0, 2000) || null,
  }
  const res = input.id
    ? await supabase.from('ad_contracts').update(row).eq('id', input.id).eq('outlet_id', outletId!).select('id').maybeSingle()
    : await supabase.from('ad_contracts').insert(row).select('id').single()
  if (res.error) return { error: /ad_contracts/.test(res.error.message) && /does not exist|schema cache|find the table/i.test(res.error.message) ? '광고 계약을 쓰려면 Supabase에서 supabase/ad-contracts.sql을 실행해 주세요.' : `저장하지 못했습니다: ${res.error.message}` }
  const id = (res.data as { id: string } | null)?.id
  if (!id) return { error: '이 계약을 고칠 권한이 없습니다.' }

  // 예약 광고 소재: 자리마다 배너 하나 (계약 기간 = 게재 기간, 그 기간에는 이 자리를 차지)
  const { data: had } = await supabase.from('ad_banners').select('id').eq('contract_id', id).eq('outlet_id', outletId!)
  const hadIds = new Set(((had ?? []) as { id: string }[]).map((b) => b.id))
  const keep = new Set<string>()
  for (const cr of creatives) {
    const bannerRow = {
      slot: cr.slot, kind: 'image', name: `${advertiser} · ${slotOf(cr.slot)!.label}`.slice(0, 80),
      image_url: cr.image, mobile_image_url: cr.mobile, link_url: cr.link,
      starts_at: kstStart(row.starts_on), ends_at: kstEnd(row.ends_on),
      active: true, exclusive: true, contract_id: id, updated_at: new Date().toISOString(),
    }
    const r = cr.id && hadIds.has(cr.id)
      ? await supabase.from('ad_banners').update(bannerRow).eq('id', cr.id).select('id').single()
      : await supabase.from('ad_banners').insert({ ...bannerRow, outlet_id: outletId! }).select('id').single()
    if (r.error) return { error: /겹칩니다/.test(r.error.message) ? `계약은 저장했지만 ${r.error.message.replace(/^.*?(광고 자리)/, '$1')} — 날짜를 바꿔 다시 저장해 주세요.` : `계약은 저장했지만 광고 소재를 올리지 못했습니다: ${r.error.message}` }
    keep.add((r.data as { id: string }).id)
  }
  const drop = [...hadIds].filter((x) => !keep.has(x))
  if (drop.length) await supabase.from('ad_banners').delete().in('id', drop).eq('outlet_id', outletId!)
  revalidateTag('ads', { expire: 0 })
  revalidatePath('/admin/ads/contracts')
  revalidatePath('/admin/ads')
  return { ok: input.id ? '고쳤습니다.' : '계약을 등록했습니다.' }
}

export async function deleteContract(id: string): Promise<ContractState> {
  const c = await ctx()
  if (!c) return { error: '광고 계약은 편집장·발행인만 관리할 수 있습니다.' }
  // 이 계약으로 예약한 광고 소재도 함께 내린다
  await c.supabase.from('ad_banners').delete().eq('contract_id', id).eq('outlet_id', c.outletId!)
  const { error } = await c.supabase.from('ad_contracts').delete().eq('id', id).eq('outlet_id', c.outletId!)
  if (error) return { error: `지우지 못했습니다: ${error.message}` }
  revalidateTag('ads', { expire: 0 })
  revalidatePath('/admin/ads/contracts')
  return { ok: '지웠습니다. 이 계약의 광고도 홈페이지에서 내렸습니다.' }
}
