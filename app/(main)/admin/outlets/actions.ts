'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { SOLO } from '@/lib/groups'
import { connectDomain } from '@/lib/vercel-domains'

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

// 그룹·매체 만들기와 수정은 IM 뉴스룸 운영팀(총관리자·매니저)만. 발행인은 업무요청으로 요청한다
async function staffContext() {
  const ctx = await getCmsContext()
  if (!ctx.isStaff) redirect('/admin/outlets')
  return ctx
}

export async function createGroup(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await staffContext()
  const name = text(form, 'name', 80)
  if (!name) return { error: '그룹 이름을 적어주세요.' }
  const { error } = await supabase.from('publishers').insert({ name })
  if (error) return { error: `만들지 못했습니다: ${error.message}` }
  revalidatePath('/admin/outlets')
  return { ok: `‘${name}’ 그룹을 만들었습니다.` }
}

export async function renameGroup(id: string, name: string): Promise<FormState> {
  const { supabase } = await staffContext()
  const clean = name.trim().slice(0, 80)
  if (!clean) return { error: '그룹 이름을 적어주세요.' }
  const { error } = await supabase.from('publishers').update({ name: clean }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: '바꿨습니다.' }
}

export async function createOutlet(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, isSuper, outletId } = await staffContext()
  const name = text(form, 'name', 80)
  const domain = cleanDomain(text(form, 'domain', 120))
  const publisher_id = text(form, 'publisher_id', 40)
  if (!name) return { error: '매체 이름을 적어주세요.' }
  if (!publisher_id) return { error: '어느 그룹의 매체인지 골라주세요.' }

  // 개별 매체: 매체를 만든 뒤 그 매체만 담는 숨은 그룹으로 옮긴다
  const solo = publisher_id === SOLO
  if (solo && !isSuper) return { error: '개별 매체는 총관리자만 만들 수 있습니다.' }
  const { data, error } = await supabase.from('outlets').insert({ name, domain: domain || null, publisher_id: solo ? null : publisher_id }).select('id').single()
  if (error || !data) return { error: `만들지 못했습니다: ${error?.message ?? ''}` }
  if (solo) {
    const { error: sErr } = await supabase.rpc('outlet_make_solo', { o: data.id })
    if (sErr) return { error: missingSql(sErr.message) ?? `매체는 만들었지만 개별 매체로 옮기지 못했습니다: ${sErr.message}` }
  }
  await supabase.from('categories').insert(DEFAULT_SECTIONS.map((c, i) => ({ ...c, outlet_id: data.id, sort_order: i + 1 })))
  // 총관리자는 아직 작업 매체가 없으면 방금 만든 매체로
  if (isSuper && !outletId) await supabase.from('profiles').update({ outlet_id: data.id }).eq('id', user.id)
  revalidatePath('/', 'layout')
  // 도메인을 넣었으면 Vercel에도 등록 (VERCEL_API_TOKEN 이 있을 때)
  const dErr = await connectDomain(domain || null)
  return { ok: `‘${name}’을(를) 만들었습니다. 기본 섹션 4개(정치·경제·사회·문화)가 들어 있습니다.${dErr ? ` (도메인 연결: ${dErr})` : ''}` }
}

// publisher_id: 옮길 그룹 id 또는 SOLO(개별 매체). 바뀔 때만 넘긴다
export async function updateOutlet(id: string, input: { name: string; domain: string; publisher_id?: string }): Promise<FormState> {
  const { supabase, isSuper } = await staffContext()
  const row: Record<string, unknown> = { name: input.name.trim().slice(0, 80), domain: cleanDomain(input.domain.trim()) || null }
  if (!row.name) return { error: '매체 이름을 적어주세요.' }
  const { error } = await supabase.from('outlets').update(row).eq('id', id)
  if (error) return { error: error.message }
  // 도메인을 Vercel에도 등록 (VERCEL_API_TOKEN 이 있을 때). 실패해도 저장은 된 상태
  const dErr = await connectDomain(row.domain as string | null)
  if (input.publisher_id) {
    // 그룹을 바꾸면 그 매체 발행인의 권한 범위도 바뀌므로 총관리자만 (DB 함수에서도 막는다)
    if (!isSuper) return { error: '그룹은 총관리자만 바꿀 수 있습니다. 이름·도메인은 저장했습니다.' }
    const { error: gErr } = input.publisher_id === SOLO
      ? await supabase.rpc('outlet_make_solo', { o: id })
      : await supabase.rpc('outlet_move', { o: id, g: input.publisher_id })
    if (gErr) return { error: missingSql(gErr.message) ?? gErr.message }
  }
  revalidatePath('/', 'layout')
  if (dErr) return { error: `저장했지만 도메인을 Vercel에 연결하지 못했습니다: ${dErr}` }
  return { ok: '저장했습니다.' }
}

// 그룹 지우기 (총관리자): 안의 매체는 모두 개별 매체로 옮긴다
export async function deleteGroup(id: string): Promise<FormState> {
  const { supabase, isSuper } = await staffContext()
  if (!isSuper) return { error: '총관리자만 그룹을 지울 수 있습니다.' }
  const { data, error } = await supabase.rpc('delete_group', { g: id })
  if (error) return { error: missingSql(error.message) ?? error.message }
  revalidatePath('/', 'layout')
  return { ok: Number(data) ? `그룹을 지우고 매체 ${data}개를 개별 매체로 옮겼습니다.` : '그룹을 지웠습니다.' }
}

function missingSql(message: string) {
  return /outlet_make_solo|outlet_move|delete_group|solo/.test(message) && /function|column|schema cache/.test(message)
    ? '총관리자가 Supabase에서 group-solo.sql을 먼저 실행해 주세요.'
    : null
}
