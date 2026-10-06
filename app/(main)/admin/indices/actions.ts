'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { INDEX_KEYS, type IndexKey } from '@/lib/market-index'

function back(msg?: { error?: string; ok?: string }): never {
  const q = msg?.error ? `?error=${encodeURIComponent(msg.error)}` : msg?.ok ? `?ok=${encodeURIComponent(msg.ok)}` : ''
  redirect(`/admin/indices${q}`)
}

async function ctx() {
  const c = await getCmsContext()
  if (!c.isEditorPlus || !c.outletId) redirect('/newsroom')
  return c
}

// 한 주 값 저장 (같은 날짜가 있으면 고친다)
export async function saveIndexPoint(form: FormData) {
  const { supabase, outletId } = await ctx()
  const key = String(form.get('index_key') ?? '') as IndexKey
  const date = String(form.get('week_date') ?? '')
  const value = Number(String(form.get('value') ?? '').replace(/,/g, ''))
  if (!INDEX_KEYS.includes(key)) back({ error: '지수를 골라 주세요.' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) back({ error: '기준일을 확인해 주세요.' })
  if (!Number.isFinite(value) || value <= 0 || value >= 100000) back({ error: '지수 값을 숫자로 적어 주세요. 예: 1,523.45' })
  const { error } = await supabase.from('market_index_points').upsert(
    { outlet_id: outletId, index_key: key, week_date: date, value, is_sample: false, updated_at: new Date().toISOString() },
    { onConflict: 'outlet_id,index_key,week_date' },
  )
  if (error) back({ error: /market_index_points/.test(error.message) ? 'market-indices.sql을 먼저 실행해 주세요.' : error.message })
  revalidateTag('market-index', { expire: 0 })
  revalidatePath('/admin/indices')
  back({ ok: `${key.toUpperCase()} ${date} 값을 저장했습니다.` })
}

export async function deleteIndexPoint(key: string, date: string) {
  const { supabase, outletId } = await ctx()
  await supabase.from('market_index_points').delete().eq('outlet_id', outletId!).eq('index_key', key).eq('week_date', date)
  revalidateTag('market-index', { expire: 0 })
  back()
}

// 시험용 샘플 값만 모두 지우기
export async function clearSampleIndex() {
  const { supabase, outletId } = await ctx()
  await supabase.from('market_index_points').delete().eq('outlet_id', outletId!).eq('is_sample', true)
  revalidateTag('market-index', { expire: 0 })
  back({ ok: '샘플 값을 모두 지웠습니다.' })
}
