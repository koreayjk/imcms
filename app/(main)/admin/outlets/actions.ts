'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import type { T } from '@/lib/cms-i18n'
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
  const { t } = await getT()
  return { ...ctx, t }
}

export async function createGroup(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, t } = await staffContext()
  const name = text(form, 'name', 80)
  if (!name) return { error: t('그룹 이름을 적어주세요.', 'Enter a group name.') }
  const { error } = await supabase.from('publishers').insert({ name })
  if (error) return { error: t(`만들지 못했습니다: ${error.message}`, `Could not create it: ${error.message}`) }
  revalidatePath('/admin/outlets')
  return { ok: t(`‘${name}’ 그룹을 만들었습니다.`, `Created the group ‘${name}’.`) }
}

export async function renameGroup(id: string, name: string): Promise<FormState> {
  const { supabase, t } = await staffContext()
  const clean = name.trim().slice(0, 80)
  if (!clean) return { error: t('그룹 이름을 적어주세요.', 'Enter a group name.') }
  const { error } = await supabase.from('publishers').update({ name: clean }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: t('바꿨습니다.', 'Updated.') }
}

export async function createOutlet(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, isSuper, outletId, t } = await staffContext()
  const name = text(form, 'name', 80)
  const domain = cleanDomain(text(form, 'domain', 120))
  const publisher_id = text(form, 'publisher_id', 40)
  if (!name) return { error: t('매체 이름을 적어주세요.', 'Enter an outlet name.') }
  if (!publisher_id) return { error: t('어느 그룹의 매체인지 골라주세요.', 'Choose which group the outlet belongs to.') }

  // 개별 매체: 매체를 만든 뒤 그 매체만 담는 숨은 그룹으로 옮긴다
  const solo = publisher_id === SOLO
  if (solo && !isSuper) return { error: t('개별 매체는 총관리자만 만들 수 있습니다.', 'Only a Super Admin can create a standalone outlet.') }
  const { data, error } = await supabase.from('outlets').insert({ name, domain: domain || null, publisher_id: solo ? null : publisher_id, site: { comingSoon: true } }).select('id').single()
  if (error || !data) return { error: t(`만들지 못했습니다: ${error?.message ?? ''}`, `Could not create it: ${error?.message ?? ''}`) }
  if (solo) {
    const { error: sErr } = await supabase.rpc('outlet_make_solo', { o: data.id })
    if (sErr) return { error: missingSql(sErr.message, t) ?? t(`매체는 만들었지만 개별 매체로 옮기지 못했습니다: ${sErr.message}`, `The outlet was created but could not be moved to standalone: ${sErr.message}`) }
  }
  await supabase.from('categories').insert(DEFAULT_SECTIONS.map((c, i) => ({ ...c, outlet_id: data.id, sort_order: i + 1 })))
  // 총관리자는 아직 작업 매체가 없으면 방금 만든 매체로
  if (isSuper && !outletId) await supabase.from('profiles').update({ outlet_id: data.id }).eq('id', user.id)
  revalidatePath('/', 'layout')
  // 도메인을 넣었으면 Vercel에도 등록 (VERCEL_API_TOKEN 이 있을 때)
  const dErr = await connectDomain(domain || null)
  return { ok: t(`‘${name}’을(를) 만들었습니다. 기본 섹션 4개(정치·경제·사회·문화)가 들어 있습니다.${dErr ? ` (도메인 연결: ${dErr})` : ''}`, `Created ‘${name}’. It includes 4 default sections (정치 Politics, 경제 Economy, 사회 Society, 문화 Culture).${dErr ? ` (Domain connection: ${dErr})` : ''}`) }
}

// publisher_id: 옮길 그룹 id 또는 SOLO(개별 매체). 바뀔 때만 넘긴다
export async function updateOutlet(id: string, input: { name: string; domain: string; publisher_id?: string }): Promise<FormState> {
  const { supabase, isSuper, t } = await staffContext()
  const row: Record<string, unknown> = { name: input.name.trim().slice(0, 80), domain: cleanDomain(input.domain.trim()) || null }
  if (!row.name) return { error: t('매체 이름을 적어주세요.', 'Enter an outlet name.') }
  const { error } = await supabase.from('outlets').update(row).eq('id', id)
  if (error) return { error: error.message }
  // 도메인을 Vercel에도 등록 (VERCEL_API_TOKEN 이 있을 때). 실패해도 저장은 된 상태
  const dErr = await connectDomain(row.domain as string | null)
  if (input.publisher_id) {
    // 그룹을 바꾸면 그 매체 발행인의 권한 범위도 바뀌므로 총관리자만 (DB 함수에서도 막는다)
    if (!isSuper) return { error: t('그룹은 총관리자만 바꿀 수 있습니다. 이름·도메인은 저장했습니다.', 'Only a Super Admin can change the group. The name and domain were saved.') }
    const { error: gErr } = input.publisher_id === SOLO
      ? await supabase.rpc('outlet_make_solo', { o: id })
      : await supabase.rpc('outlet_move', { o: id, g: input.publisher_id })
    if (gErr) return { error: missingSql(gErr.message, t) ?? gErr.message }
  }
  revalidatePath('/', 'layout')
  if (dErr) return { error: t(`저장했지만 도메인을 Vercel에 연결하지 못했습니다: ${dErr}`, `Saved, but the domain could not be connected on Vercel: ${dErr}`) }
  return { ok: t('저장했습니다.', 'Saved.') }
}

// 그룹 지우기 (총관리자): 안의 매체는 모두 개별 매체로 옮긴다
export async function deleteGroup(id: string): Promise<FormState> {
  const { supabase, isSuper, t } = await staffContext()
  if (!isSuper) return { error: t('총관리자만 그룹을 지울 수 있습니다.', 'Only a Super Admin can delete a group.') }
  const { data, error } = await supabase.rpc('delete_group', { g: id })
  if (error) return { error: missingSql(error.message, t) ?? error.message }
  revalidatePath('/', 'layout')
  return { ok: Number(data) ? t(`그룹을 지우고 매체 ${data}개를 개별 매체로 옮겼습니다.`, `Deleted the group and moved ${data} ${Number(data) === 1 ? 'outlet' : 'outlets'} to standalone.`) : t('그룹을 지웠습니다.', 'Deleted the group.') }
}

function missingSql(message: string, t: T) {
  return /outlet_make_solo|outlet_move|delete_group|solo/.test(message) && /function|column|schema cache/.test(message)
    ? t('총관리자가 Supabase에서 group-solo.sql을 먼저 실행해 주세요.', 'A Super Admin needs to run group-solo.sql in Supabase first.')
    : null
}

// 빈 매체 지우기 (총관리자, outlet-delete.sql): 기사·회원·청구서·결제가 하나도 없는 매체만 (테스트 매체 정리용)
export async function deleteOutlet(id: string): Promise<FormState> {
  const { supabase, isSuper, t } = await staffContext()
  if (!isSuper) return { error: t('매체는 총관리자만 지울 수 있습니다.', 'Only a Super Admin can delete an outlet.') }
  const { data, error } = await supabase.rpc('admin_delete_outlet', { o: id })
  if (error) return { error: /admin_delete_outlet/.test(error.message) ? t('매체를 지우려면 총관리자가 Supabase에서 outlet-delete.sql을 먼저 실행해 주세요.', 'To delete an outlet, a Super Admin needs to run outlet-delete.sql in Supabase first.') : error.message }
  revalidatePath('/', 'layout')
  return { ok: t(`${data ?? '매체'}을(를) 지웠습니다.`, `Deleted ${data ?? 'the outlet'}.`) }
}
