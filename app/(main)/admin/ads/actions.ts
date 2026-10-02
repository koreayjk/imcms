'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { fromKstInput } from '@/lib/format'
import { slotOf } from '@/lib/ads'

export type AdState = { error?: string; ok?: string }

export type AdInput = {
  id?: string
  slot: string
  kind: 'image' | 'code'
  name: string
  image_url: string
  mobile_image_url: string
  link_url: string
  code: string
  starts_at: string // datetime-local (한국 시간)
  ends_at: string
  active: boolean
  sort_order: number
}

const httpUrl = (v: string) => {
  const t = v.trim()
  if (!t) return null
  const u = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try { return new URL(u).protocol.startsWith('http') ? u : null } catch { return null }
}

function done() {
  revalidateTag('ads')
  revalidatePath('/admin/ads')
}

// 배너 저장 (편집장·발행인·운영팀). 광고 코드는 운영팀만 (DB 권한으로도 막는다)
export async function saveBanner(input: AdInput): Promise<AdState> {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return { error: '광고는 편집장·발행인만 관리할 수 있습니다.' }
  if (!outletId) return { error: '위쪽에서 작업할 매체를 먼저 골라 주세요.' }
  if (!slotOf(input.slot)) return { error: '광고 자리를 골라 주세요.' }
  const name = input.name.trim().slice(0, 80)
  if (!name) return { error: '광고주·광고 이름을 적어 주세요.' }
  const kind = input.kind === 'code' ? 'code' : 'image'
  if (kind === 'code' && !isStaff) return { error: '광고 코드는 IM 뉴스룸 운영팀만 넣을 수 있습니다. 고객센터에 업무요청을 남겨 주세요.' }

  const image = httpUrl(input.image_url)
  const mobile = httpUrl(input.mobile_image_url)
  const link = httpUrl(input.link_url)
  if (kind === 'image' && !image) return { error: 'PC용 배너 이미지를 올려 주세요.' }
  if (input.link_url.trim() && !link) return { error: '연결할 주소를 확인해 주세요. 예: https://example.com' }
  const code = input.code.trim().slice(0, 20000)
  if (kind === 'code' && !code) return { error: '광고 코드를 붙여넣어 주세요.' }

  const starts = input.starts_at ? fromKstInput(input.starts_at) : null
  const ends = input.ends_at ? fromKstInput(input.ends_at) : null
  if ((input.starts_at && !starts) || (input.ends_at && !ends)) return { error: '게재 기간을 확인해 주세요.' }
  if (starts && ends && Date.parse(ends) <= Date.parse(starts)) return { error: '끝나는 시각이 시작 시각보다 뒤여야 합니다.' }

  const row = {
    slot: input.slot,
    kind,
    name,
    image_url: kind === 'image' ? image : null,
    mobile_image_url: kind === 'image' ? mobile : null,
    link_url: kind === 'image' ? link : null,
    code: kind === 'code' ? code : null,
    starts_at: starts,
    ends_at: ends,
    active: input.active,
    sort_order: Number.isFinite(input.sort_order) ? Math.max(0, Math.min(999, Math.round(input.sort_order))) : 0,
    updated_at: new Date().toISOString(),
  }
  const q = input.id
    ? supabase.from('ad_banners').update(row).eq('id', input.id).select('id')
    : supabase.from('ad_banners').insert({ ...row, outlet_id: outletId }).select('id')
  const { data, error } = await q
  if (error) return { error: /ad_banners/.test(error.message) && /exist|schema/.test(error.message) ? 'Supabase에서 supabase/ad-banners.sql을 먼저 실행해 주세요.' : `저장하지 못했습니다: ${error.message}` }
  if (!data?.length) return { error: '저장 권한이 없습니다.' }
  done()
  return { ok: input.id ? '저장했습니다.' : '배너를 올렸습니다.' }
}

export async function setBannerActive(id: string, active: boolean): Promise<AdState> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.from('ad_banners').update({ active, updated_at: new Date().toISOString() }).eq('id', id).select('id')
  if (error || !data?.length) return { error: error?.message ?? '바꿀 권한이 없습니다.' }
  done()
  return { ok: active ? '켰습니다.' : '껐습니다.' }
}

export async function deleteBanner(id: string): Promise<AdState> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.from('ad_banners').delete().eq('id', id).select('id')
  if (error || !data?.length) return { error: error?.message ?? '지울 권한이 없습니다.' }
  done()
  return { ok: '지웠습니다.' }
}
