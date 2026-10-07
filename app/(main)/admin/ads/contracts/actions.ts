'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

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
  banner_ids: string[]
  // 연결한 배너의 게재 기간을 계약 기간에 맞춘다
  sync_banners: boolean
}

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

  // 배너 연결: 고른 배너는 이 계약으로, 빠진 배너는 연결 해제
  const ids = (input.banner_ids ?? []).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 30)
  const { error: e1 } = await supabase.from('ad_banners').update({ contract_id: null }).eq('contract_id', id).eq('outlet_id', outletId!)
  if (!e1 && ids.length) {
    const patch: Record<string, unknown> = { contract_id: id }
    if (input.sync_banners) { patch.starts_at = kstStart(row.starts_on); patch.ends_at = kstEnd(row.ends_on) }
    await supabase.from('ad_banners').update(patch).in('id', ids).eq('outlet_id', outletId!)
    revalidateTag('ads', { expire: 0 })
  }
  revalidatePath('/admin/ads/contracts')
  revalidatePath('/admin/ads')
  return { ok: input.id ? '고쳤습니다.' : '계약을 등록했습니다.' }
}

export async function deleteContract(id: string): Promise<ContractState> {
  const c = await ctx()
  if (!c) return { error: '광고 계약은 편집장·발행인만 관리할 수 있습니다.' }
  const { error } = await c.supabase.from('ad_contracts').delete().eq('id', id).eq('outlet_id', c.outletId!)
  if (error) return { error: `지우지 못했습니다: ${error.message}` }
  revalidatePath('/admin/ads/contracts')
  return { ok: '지웠습니다. 연결된 배너는 그대로 남습니다.' }
}
