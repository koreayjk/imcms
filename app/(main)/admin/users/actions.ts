'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import type { UserRole } from '@/lib/types'

const ROLES: UserRole[] = ['reporter', 'editor', 'admin']
export type FormState = { error?: string; ok?: string }

async function groupContext() {
  const ctx = await getCmsContext()
  if (!ctx.isGroupAdmin) redirect('/newsroom')
  return ctx
}

function fail(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`)
}

// 발행인은 매체가 아니라 그룹 전체를 맡으므로 그룹 표시(publisher_id)가 필요하다
async function publisherOf(supabase: Awaited<ReturnType<typeof getCmsContext>>['supabase'], outletId: string | null) {
  if (!outletId) return null
  const { data } = await supabase.from('outlets').select('publisher_id').eq('id', outletId).maybeSingle()
  return ((data as any)?.publisher_id as string | null) ?? null
}

export async function approveUser(id: string, form: FormData) {
  // 총관리자는 모든 가입 신청, 발행인은 우리 그룹 매체로 신청한 사람만 (DB가 한 번 더 확인한다)
  const { supabase, isSuper } = await groupContext()
  const roleInput = String(form.get('role') ?? 'reporter')
  const outletId = String(form.get('outlet_id') ?? '') || null
  // IM 뉴스룸 매니저: 매체에 속하지 않고 상담·업무요청을 처리한다
  if (roleInput === 'staff') {
    if (!isSuper) fail('매니저 지정은 총관리자만 할 수 있습니다.')
    const { error } = await supabase.from('profiles').update({ approved: true, is_staff: true, role: 'reporter', outlet_id: null, publisher_id: null }).eq('id', id)
    if (error) fail(/is_staff/.test(error.message) ? '매니저를 두려면 staff.sql을 실행해 주세요.' : `승인하지 못했습니다: ${error.message}`)
    revalidatePath('/', 'layout')
    return
  }
  const role = roleInput as UserRole
  if (!ROLES.includes(role)) fail('역할을 확인해 주세요.')
  if (!outletId) fail('소속 매체를 정해주세요.')
  const publisher_id = role === 'admin' ? await publisherOf(supabase, outletId) : null
  const { data: done, error } = await supabase.from('profiles').update({ approved: true, role, outlet_id: outletId, publisher_id }).eq('id', id).select('id')
  if (error) fail(/row-level security|권한/.test(error.message) ? '우리 그룹 매체로만 승인할 수 있습니다.' : `승인하지 못했습니다: ${error.message}`)
  if (!done?.length) fail('이 가입 신청을 승인할 권한이 없습니다.')
  revalidatePath('/', 'layout')
}

export async function rejectUser(id: string) {
  const { supabase } = await groupContext()
  const { error } = await supabase.rpc('admin_reject_user', { target: id })
  if (error) fail(`거절하지 못했습니다: ${error.message}`)
  revalidatePath('/', 'layout')
}

export async function setMember(id: string, input: { role: UserRole; outletId: string | null; fullName?: string }): Promise<FormState> {
  const { supabase, user } = await groupContext()
  if (!ROLES.includes(input.role)) return { error: '역할을 확인해 주세요.' }
  if (id === user.id && input.role !== 'admin') return { error: '내 발행인 권한은 스스로 내릴 수 없습니다.' }
  const row: Record<string, unknown> = {
    role: input.role,
    outlet_id: input.outletId,
    publisher_id: input.role === 'admin' ? await publisherOf(supabase, input.outletId) : null,
  }
  if (input.fullName !== undefined) {
    const n = input.fullName.trim().replace(/\s+/g, ' ').slice(0, 30)
    if (n) row.full_name = n
  }
  if (input.role === 'admin' && !row.publisher_id) return { error: '발행인은 그룹이 있는 매체를 골라야 합니다.' }
  const { error } = await supabase.from('profiles').update(row).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { ok: '저장했습니다.' }
}

// 기자·편집장의 소속 매체와 매체별 직급 (같은 그룹 매체만, outlet-members.sql)
export type Membership = { outletId: string; role: 'reporter' | 'editor' }
export async function setMemberships(id: string, items: Membership[], fullName?: string): Promise<FormState> {
  const { supabase, user } = await groupContext()
  if (id === user.id) return { error: '내 소속은 스스로 바꿀 수 없습니다.' }
  if (!items.length) return { error: '소속 매체를 하나 이상 정해 주세요.' }
  if (new Set(items.map((i) => i.outletId)).size !== items.length) return { error: '같은 매체가 두 번 들어 있습니다.' }
  const { error } = await supabase.rpc('admin_set_memberships', {
    target: id,
    items: items.map((i) => ({ outlet_id: i.outletId, role: i.role })),
  })
  if (error) return { error: /admin_set_memberships|outlet_members/.test(error.message) ? '여러 매체 소속을 쓰려면 outlet-members.sql을 실행해 주세요.' : error.message }
  const n = fullName?.trim().replace(/\s+/g, ' ').slice(0, 30)
  if (n) await supabase.from('profiles').update({ full_name: n }).eq('id', id)
  revalidatePath('/', 'layout')
  return { ok: '저장했습니다.' }
}

export async function inviteMember(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await groupContext()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 30) || null
  const role = String(form.get('role') ?? 'reporter') as UserRole
  const outlet_id = String(form.get('outlet_id') ?? '') || null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '이메일 주소를 확인해 주세요.' }
  if (!ROLES.includes(role)) return { error: '역할을 골라주세요.' }
  if (!outlet_id) return { error: '소속 매체를 골라주세요.' }
  const publisher_id = await publisherOf(supabase, outlet_id)
  if (!publisher_id) return { error: '그룹에 속한 매체를 골라주세요.' }

  const { data, error } = await supabase.from('invitations').insert({ email, full_name, role, outlet_id, publisher_id }).select('accepted_at').single()
  if (error) {
    if (/invitations_open_email|duplicate/i.test(error.message)) return { error: '이미 초대한 이메일입니다. 아래 초대 목록을 확인하세요.' }
    return { error: `초대하지 못했습니다: ${error.message}` }
  }
  revalidatePath('/admin/users')
  return {
    ok: data?.accepted_at
      ? `${email}은(는) 이미 가입한 계정이라 바로 적용했습니다.`
      : `${email}을(를) 초대했습니다. 이 이메일(또는 같은 주소의 구글 계정)로 가입하면 바로 승인되어 들어옵니다.`,
  }
}

export async function cancelInvite(id: string) {
  const { supabase } = await groupContext()
  await supabase.from('invitations').delete().eq('id', id).is('accepted_at', null)
  revalidatePath('/admin/users')
}

// 매니저 지정·해제 (총관리자만, DB에서도 막혀 있음)
export async function setStaff(id: string, on: boolean) {
  const { supabase, isSuper } = await groupContext()
  if (!isSuper) fail('매니저 지정은 총관리자만 할 수 있습니다.')
  const { error } = await supabase.from('profiles').update(on ? { is_staff: true, approved: true } : { is_staff: false }).eq('id', id)
  if (error) fail(/is_staff/.test(error.message) ? '매니저를 두려면 staff.sql을 실행해 주세요.' : error.message)
  revalidatePath('/', 'layout')
}

export async function appointStaff(form: FormData) {
  const id = String(form.get('user_id') ?? '')
  if (id) await setStaff(id, true)
}

// 매니저의 담당 매체 (총관리자만, staff-outlets.sql). 담당 매체에서 들어온 업무요청은 자동으로 그 매니저에게 배정된다
export async function setStaffOutlets(id: string, outletIds: string[]): Promise<FormState> {
  const { supabase, isSuper } = await groupContext()
  if (!isSuper) return { error: '담당 매체는 총관리자만 정할 수 있습니다.' }
  const { error } = await supabase.rpc('admin_set_staff_outlets', { target: id, outlet_ids: outletIds })
  if (error) return { error: /admin_set_staff_outlets/.test(error.message) ? '담당 매체를 쓰려면 staff-outlets.sql을 실행해 주세요.' : error.message }
  revalidatePath('/admin/users')
  return { ok: '저장했습니다.' }
}

// 회원 탈퇴(계정 삭제) — 총관리자만 (member-delete.sql). 쓴 기사는 기자명 그대로 남는다
export async function deleteMember(id: string): Promise<FormState> {
  const { supabase, isSuper, user } = await groupContext()
  if (!isSuper) return { error: '회원 탈퇴는 총관리자만 할 수 있습니다.' }
  if (id === user.id) return { error: '내 계정은 여기서 탈퇴시킬 수 없습니다.' }
  const { error } = await supabase.rpc('admin_delete_user', { target: id })
  if (error) return { error: /admin_delete_user/.test(error.message) ? '회원 탈퇴를 쓰려면 member-delete.sql을 실행해 주세요.' : error.message }
  revalidatePath('/', 'layout')
  return { ok: '탈퇴 처리했습니다.' }
}

// 출입 정지 · 해제 (퇴사자 등, account-security.sql). 발행인은 우리 그룹 기자·편집장, 총관리자는 모두 (DB가 확인한다)
//   정지하면 바로 편집국과 DB 자료를 못 연다. 쓴 기사는 기자명 그대로 남는다
export async function suspendMember(id: string, suspend: boolean): Promise<FormState> {
  const { supabase } = await groupContext()
  const { error } = await supabase.rpc('admin_suspend_user', { target: id, suspend })
  if (error) return { error: /admin_suspend_user/.test(error.message) ? '출입 정지를 쓰려면 account-security.sql을 실행해 주세요.' : error.message }
  revalidatePath('/admin/users')
  return { ok: suspend ? '출입을 정지했습니다.' : '정지를 풀었습니다.' }
}

// 2단계 인증 초기화 (휴대폰을 잃어버린 회원). 다음 로그인 때 인증 앱을 새로 등록한다
export async function resetMemberMfa(id: string): Promise<FormState> {
  const { supabase } = await groupContext()
  const { error } = await supabase.rpc('admin_reset_mfa', { target: id })
  if (error) return { error: /admin_reset_mfa/.test(error.message) ? '2단계 인증을 쓰려면 account-security.sql을 실행해 주세요.' : error.message }
  revalidatePath('/admin/users')
  return { ok: '2단계 인증을 초기화했습니다.' }
}
