'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

export type FormState = { error?: string; ok?: string }

const text = (form: FormData, k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max)
const cleanDomain = (d: string) => d.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()

// 새 매체에 기본으로 만드는 섹션 (섹션 메뉴에서 바꿀 수 있다)
const DEFAULT_SECTIONS = [
  { name: '정치', slug: 'politics' },
  { name: '경제', slug: 'economy' },
  { name: '사회', slug: 'society' },
  { name: '문화', slug: 'culture' },
]

async function groupContext() {
  const ctx = await getCmsContext()
  if (!ctx.isGroupAdmin) redirect('/newsroom')
  return ctx
}

export async function createGroup(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, isSuper } = await groupContext()
  if (!isSuper) return { error: '그룹은 총관리자만 만들 수 있습니다.' }
  const name = text(form, 'name', 80)
  if (!name) return { error: '그룹 이름을 적어주세요.' }
  const { error } = await supabase.from('publishers').insert({ name })
  if (error) return { error: `만들지 못했습니다: ${error.message}` }
  revalidatePath('/admin/outlets')
  return { ok: `‘${name}’ 그룹을 만들었습니다.` }
}

export async function renameGroup(id: string, name: string): Promise<FormState> {
  const { supabase } = await groupContext()
  const clean = name.trim().slice(0, 80)
  if (!clean) return { error: '그룹 이름을 적어주세요.' }
  const { error } = await supabase.from('publishers').update({ name: clean }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: '바꿨습니다.' }
}

export async function createOutlet(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, isSuper, publisherId, outletId } = await groupContext()
  const name = text(form, 'name', 80)
  const domain = cleanDomain(text(form, 'domain', 120))
  // 총관리자는 그룹을 고르고, 발행인은 자기 그룹에만 만든다
  const publisher_id = isSuper ? text(form, 'publisher_id', 40) || publisherId : publisherId
  if (!name) return { error: '매체 이름을 적어주세요.' }
  if (!publisher_id) return { error: '어느 그룹의 매체인지 골라주세요.' }

  const { data, error } = await supabase.from('outlets').insert({ name, domain: domain || null, publisher_id }).select('id').single()
  if (error || !data) return { error: `만들지 못했습니다: ${error?.message ?? ''}` }
  await supabase.from('categories').insert(DEFAULT_SECTIONS.map((c, i) => ({ ...c, outlet_id: data.id, sort_order: i + 1 })))
  // 아직 작업 매체가 없으면 방금 만든 매체로
  if (!outletId) await supabase.from('profiles').update({ outlet_id: data.id }).eq('id', user.id)
  revalidatePath('/', 'layout')
  return { ok: `‘${name}’을(를) 만들었습니다. 기본 섹션 4개(정치·경제·사회·문화)가 들어 있습니다.` }
}

export async function updateOutlet(id: string, input: { name: string; domain: string; publisher_id?: string }): Promise<FormState> {
  const { supabase, isSuper } = await groupContext()
  const row: Record<string, unknown> = { name: input.name.trim().slice(0, 80), domain: cleanDomain(input.domain.trim()) || null }
  if (!row.name) return { error: '매체 이름을 적어주세요.' }
  if (isSuper && input.publisher_id) row.publisher_id = input.publisher_id
  const { error } = await supabase.from('outlets').update(row).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: '저장했습니다.' }
}
